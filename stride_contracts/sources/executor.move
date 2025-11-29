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

        // 2. Hold funds in vault temporarily for Convex backend to process
        // Convex will execute the Decibel swap via API
        primary_fungible_store::deposit(vault_addr, input_fa);

        // 3. Emit SwapPending event for Convex to process
        // Convex polls for this event and executes actual Decibel swap
        event::emit(SwapPending {
            vault_addr,
            vault_owner,
            sip_index,
            input_asset: input_asset_addr,
            target_asset: target_asset_addr,
            amount_in,
            timestamp: now,
        });

        // 4. For testnet demo: Update SIP stats immediately with simulated output
        // In production, Convex will call back with actual amounts after swap
        let simulated_output = amount_in;
        sip_vault::update_sip_after_execution(vault_obj, sip_index, amount_in, simulated_output);

        let reward_points = amount_in / 10;
        rewards::add_points(vault_owner, reward_points);

        // 5. Emit completion events
        event::emit(SwapExecuted {
            vault_addr,
            input_asset: input_asset_addr,
            output_asset: target_asset_addr,
            amount_in,
            amount_out: simulated_output,
            market_id: 1,
            timestamp: now,
        });

        event::emit(SIPExecutionCompleted {
            vault_addr,
            sip_index,
            amount_in,
            amount_out: simulated_output,
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
