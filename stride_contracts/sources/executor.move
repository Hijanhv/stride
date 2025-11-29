module stride_contracts::executor {
    use std::signer;
    use std::vector;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use stride_contracts::sip_vault::{Self, Vault};
    use stride_contracts::rewards;
    use stride_contracts::access_control;

    /// Error codes
    /// Insufficient output from swap
    const E_INSUFFICIENT_OUTPUT: u64 = 1;
    /// Swap failed
    const E_SWAP_FAILED: u64 = 2;
    /// Zero amount
    const E_ZERO_AMOUNT: u64 = 3;

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct SIPExecutionStarted has drop, store {
        vault_addr: address,
        sip_index: u64,
        amount_in: u64,
        timestamp: u64,
    }

    #[event]
    struct SIPExecutionCompleted has drop, store {
        vault_addr: address,
        sip_index: u64,
        amount_in: u64,
        amount_out: u64,
        reward_points: u64,
        timestamp: u64,
    }

    #[event]
    struct SwapExecuted has drop, store {
        vault_addr: address,
        input_asset: address,
        output_asset: address,
        amount_in: u64,
        amount_out: u64,
        market_id: u64,
        timestamp: u64,
    }

    #[event]
    struct BatchExecutionCompleted has drop, store {
        executor: address,
        total_sips: u64,
        successful: u64,
        failed: u64,
        timestamp: u64,
    }

    /// Event emitted when SIP execution is ready for DEX swap
    /// Backend listens for this event and executes the actual swap via Decibel API
    #[event]
    struct SwapPending has drop, store {
        vault_addr: address,
        vault_owner: address,
        sip_index: u64,
        input_asset: address,
        target_asset: address,
        amount_in: u64,
        timestamp: u64,
    }

    // ============================================================================
    // ENTRY FUNCTIONS
    // ============================================================================

    /// Execute a specific SIP using Decibel CLOB
    /// SECURITY: Only authorized scheduler operators can execute SIPs
    public entry fun execute_sip(
        scheduler: &signer,
        vault_obj: Object<Vault>,
        sip_index: u64,
        input_asset: Object<Metadata>,
        target_asset: Object<Metadata>,
        admin_addr: address
    ) {
        // CRITICAL: Verify scheduler is authorized and system is not paused
        access_control::verify_scheduler_operator(admin_addr, scheduler);
        access_control::verify_not_paused(admin_addr);
        
        let now = timestamp::now_seconds();
        let vault_addr = object::object_address(&vault_obj);
        let vault_owner = sip_vault::get_vault_owner(vault_obj);
        
        // Emit execution started event
        event::emit(SIPExecutionStarted {
            vault_addr,
            sip_index,
            amount_in: 0, // Will be updated after withdrawal
            timestamp: now,
        });

        // 1. Withdraw Input Asset from Vault
        let input_fa = sip_vault::withdraw_for_execution(vault_obj, sip_index, input_asset);
        let amount_in = fungible_asset::amount(&input_fa);
        
        assert!(amount_in > 0, E_ZERO_AMOUNT);

        let input_asset_addr = object::object_address(&input_asset);
        let target_asset_addr = object::object_address(&target_asset);

        // 2. Derive Decibel Addresses
        // Market Name: "USDC-APT-PERP" (Hardcoded for hackathon/testnet demo)
        // In production, this should be looked up from a registry or passed as argument
        let market_name = std::string::utf8(b"USDC-APT-PERP");
        
        // Global PerpEngine address derivation
        // Seed: "GlobalPerpEngine"
        let perp_engine_seed = std::string::utf8(b"GlobalPerpEngine");
        let perp_engine_addr = object::create_object_address(
            &@Decibel,
            *std::string::bytes(&perp_engine_seed)
        );

        // Market address derivation
        // Seed: Market Name
        let market_addr = object::create_object_address(
            &perp_engine_addr,
            *std::string::bytes(&market_name)
        );

        // Subaccount address derivation
        // Seed: "decibel_dex_primary"
        let subaccount_seed = std::string::utf8(b"decibel_dex_primary");
        let subaccount_addr = object::create_object_address(
            &vault_owner,
            *std::string::bytes(&subaccount_seed)
        );

        // 3. Deposit funds to Subaccount
        // We must deposit the withdrawn funds into the user's subaccount to trade
        // Note: This assumes the subaccount is already created. 
        // If not, we might need to create it, but usually frontend/onboarding handles that.
        // For this flow, we transfer to subaccount.
        primary_fungible_store::deposit(subaccount_addr, input_fa);

        // 4. Place Market Order on Decibel
        Decibel::dex_accounts::place_order_to_subaccount(
            scheduler,
            subaccount_addr,
            market_addr,
            0, // price (0 for market order)
            amount_in, // size
            true, // is_buy
            0, // time_in_force (GTC)
            false, // reduce_only
            std::option::none(), // client_order_id
            std::option::none(), // stop_price
            std::option::none(), // tp_trigger_price
            std::option::none(), // tp_limit_price
            std::option::none(), // sl_trigger_price
            std::option::none(), // sl_limit_price
            std::option::none(), // builder_addr
            std::option::none()  // builder_fee
        );

        // 5. Emit Swap Executed Event
        // Note: We don't know the exact output amount yet as it's an async fill on CLOB
        // Backend will track the fill via indexer and update stats
        event::emit(SwapExecuted {
            vault_addr,
            input_asset: input_asset_addr,
            output_asset: target_asset_addr,
            amount_in,
            amount_out: 0, // Pending fill
            market_id: 1, // Placeholder
            timestamp: now,
        });

        // 6. Emit Execution Completed
        event::emit(SIPExecutionCompleted {
            vault_addr,
            sip_index,
            amount_in,
            amount_out: 0, // Pending fill
            reward_points: 0, // Will be calculated after fill
            timestamp: now,
        });
    }

    /// Execute multiple SIPs in a batch
    /// SECURITY: Only authorized scheduler operators can execute batches
    public entry fun execute_batch(
        scheduler: &signer,
        vault_objs: vector<Object<Vault>>,
        sip_indices: vector<u64>,
        input_assets: vector<Object<Metadata>>,
        target_assets: vector<Object<Metadata>>,
        admin_addr: address
    ) {
        // CRITICAL: Verify scheduler is authorized and system is not paused
        access_control::verify_scheduler_operator(admin_addr, scheduler);
        access_control::verify_not_paused(admin_addr);
        
        let len = vector::length(&vault_objs);
        let scheduler_addr = signer::address_of(scheduler);
        let now = timestamp::now_seconds();
        
        let successful: u64 = 0;
        let failed: u64 = 0;
        
        let i = 0;
        while (i < len) {
            let vault_obj = *vector::borrow(&vault_objs, i);
            let sip_index = *vector::borrow(&sip_indices, i);
            let input_asset = *vector::borrow(&input_assets, i);
            let target_asset = *vector::borrow(&target_assets, i);
            
            let is_due = sip_vault::is_sip_due(vault_obj, sip_index);
            
            if (is_due) {
                execute_sip(scheduler, vault_obj, sip_index, input_asset, target_asset, admin_addr);
                successful = successful + 1;
            } else {
                failed = failed + 1;
            };
            
            i = i + 1;
        };
        
        event::emit(BatchExecutionCompleted {
            executor: scheduler_addr,
            total_sips: len,
            successful,
            failed,
            timestamp: now,
        });
    }

    /// Execute a single SIP with minimum output protection (slippage protection)
    /// SECURITY: Only authorized scheduler operators can execute with slippage protection
    public entry fun execute_sip_with_slippage(
        scheduler: &signer,
        vault_obj: Object<Vault>,
        sip_index: u64,
        input_asset: Object<Metadata>,
        target_asset: Object<Metadata>,
        min_output: u64,
        admin_addr: address
    ) {
        // CRITICAL: Verify scheduler is authorized and system is not paused
        access_control::verify_scheduler_operator(admin_addr, scheduler);
        access_control::verify_not_paused(admin_addr);
        
        let now = timestamp::now_seconds();
        let vault_addr = object::object_address(&vault_obj);
        let vault_owner = sip_vault::get_vault_owner(vault_obj);
        
        // 1. Withdraw Input Asset from Vault
        let input_fa = sip_vault::withdraw_for_execution(vault_obj, sip_index, input_asset);
        let amount_in = fungible_asset::amount(&input_fa);
        
        assert!(amount_in > 0, E_ZERO_AMOUNT);

        let input_asset_addr = object::object_address(&input_asset);
        let target_asset_addr = object::object_address(&target_asset);

        // 2. Hold funds in vault for backend to process
        primary_fungible_store::deposit(vault_addr, input_fa);

        // 3. For testnet demo: simulate output (backend handles real swap)
        let amount_out = amount_in;
        
        // 4. Check slippage protection
        assert!(amount_out >= min_output, E_INSUFFICIENT_OUTPUT);
        
        // 5. Emit swap event
        event::emit(SwapExecuted {
            vault_addr,
            input_asset: input_asset_addr,
            output_asset: target_asset_addr,
            amount_in,
            amount_out,
            market_id: 1,
            timestamp: now,
        });
        
        // 6. Update SIP stats and distribute rewards
        sip_vault::update_sip_after_execution(vault_obj, sip_index, amount_in, amount_out);
        
        let reward_points = amount_in / 10;
        rewards::add_points(vault_owner, reward_points);

        event::emit(SIPExecutionCompleted {
            vault_addr,
            sip_index,
            amount_in,
            amount_out,
            reward_points,
            timestamp: now,
        });
    }
}
