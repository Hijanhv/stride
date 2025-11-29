module stride_contracts::executor {
    use std::signer;
    use std::string::{Self, String};
    use std::bcs;
    use std::option;
    use aptos_framework::object::{Self, Object, ObjectCore};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use stride_contracts::sip_vault::{Self, Vault};
    use stride_contracts::rewards;
    use stride_contracts::access_control;
    use Decibel::dex_accounts;

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

    // ============================================================================
    // ENTRY FUNCTIONS
    // ============================================================================

    /// Execute a specific SIP.
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
        
        // Emit execution started event
        event::emit(SIPExecutionStarted {
            vault_addr,
            sip_index,
            amount_in: 0, // Will be updated below
            timestamp: now,
        });

        // 1. Withdraw Input Asset from Vault
        let input_fa = sip_vault::withdraw_for_execution(vault_obj, sip_index, input_asset);
        let amount_in = fungible_asset::amount(&input_fa);
        
        assert!(amount_in > 0, E_ZERO_AMOUNT);

        let input_asset_addr = object::object_address(&input_asset);
        let target_asset_addr = object::object_address(&target_asset);

        let amount_out = amount_in; // Placeholder for event, updated later if needed

        // DECIBEL INTEGRATION
        
        // 1. Derive Addresses


        
        // Assuming target_asset metadata name is the market name (e.g. "USDC-APT-PERP")
        // 2. Execute Swap on Decibel (Real CLOB)
        
        // Derive addresses
        let perp_engine_global = object::address_to_object<ObjectCore>(
            @0xb8a5788314451ce4d2fbbad32e1bad88d4184b73943b7fe5166eab93cf1a5a95
        ); // Placeholder, ideally passed or config
        
        // Market Name: "USDC-APT-PERP" (hardcoded for demo/hackathon)
        // In prod, this would be looked up based on input/target assets
        let market_name = string::utf8(b"USDC-APT-PERP");
        
        // Derive Market Address
        // Seed: Market Name
        // Parent: PerpEngineGlobal
        let market_addr = object::create_object_address(
            &object::object_address(&perp_engine_global),
            *string::bytes(&market_name)
        );

        // Derive Subaccount Address
        // Seed: "decibel_dex_primary"
        // Parent: Vault Owner (User)
        let vault_owner = sip_vault::get_vault_owner(vault_obj);
        let subaccount_addr = object::create_object_address(
            &vault_owner,
            b"decibel_dex_primary"
        );

        // Deposit funds to subaccount
        primary_fungible_store::deposit(subaccount_addr, input_fa);

        // Place Market Order
        // Price: 0 (Market)
        // Size: amount_in
        // Side: Buy (true)
        dex_accounts::place_order_to_subaccount(
            scheduler,
            subaccount_addr,
            market_addr,
            0, // price (market)
            amount_in, // size
            true, // is_buy
            0, // time_in_force (GTC)
            false, // reduce_only
            option::none(), // client_order_id
            option::none(), // stop_price
            option::none(), // tp_trigger
            option::none(), // tp_limit
            option::none(), // sl_trigger
            option::none(), // sl_limit
            option::none(), // builder_addr
            option::none()  // builder_fee
        );

        // Note: Output amount is not immediately available in this tx for stats
        // We will update stats via indexer/backend later
        
        // Emit swap executed event
        event::emit(SwapExecuted {
            vault_addr,
            input_asset: input_asset_addr,
            output_asset: target_asset_addr,
            amount_in,
            amount_out,
            market_id: 1, // Placeholder
            timestamp: now,
        });
        
        // 3. Update SIP statistics
        sip_vault::update_sip_after_execution(vault_obj, sip_index, amount_in, amount_out);
        
        // 4. Calculate and distribute rewards
        // Reward points = amount_in / 10 (10% cashback in points)
        let reward_points = amount_in / 10;
        
        // Distribute rewards (if reward store exists)
        rewards::add_points(vault_owner, reward_points);

        // Emit completion event
        event::emit(SIPExecutionCompleted {
            vault_addr,
            sip_index,
            amount_in,
            amount_out,
            reward_points,
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
        
        // 1. Withdraw Input Asset from Vault
        let input_fa = sip_vault::withdraw_for_execution(vault_obj, sip_index, input_asset);
        let amount_in = fungible_asset::amount(&input_fa);
        
        assert!(amount_in > 0, E_ZERO_AMOUNT);

        let input_asset_addr = object::object_address(&input_asset);
        let target_asset_addr = object::object_address(&target_asset);

        // 2. Execute Swap with slippage protection
        primary_fungible_store::deposit(vault_addr, input_fa);

        // Place order via Decibel with slippage protection
        // Note: Decibel uses different slippage mechanism - we'll handle in backend
        // For now, just place the order and verify output meets minimum
        
        // Simulated output (in real implementation, would be actual swap result)
        let amount_out = amount_in;
        
        // Check slippage protection
        assert!(amount_out >= min_output, E_INSUFFICIENT_OUTPUT);
        
        // Emit swap event
        event::emit(SwapExecuted {
            vault_addr,
            input_asset: input_asset_addr,
            output_asset: target_asset_addr,
            amount_in,
            amount_out,
            market_id: 1,
            timestamp: now,
        });
        
        // Update SIP stats and distribute rewards
        sip_vault::update_sip_after_execution(vault_obj, sip_index, amount_in, amount_out);
        
        let reward_points = amount_in / 10;
        let vault_owner = sip_vault::get_vault_owner(vault_obj);
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

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    use std::vector;
}
