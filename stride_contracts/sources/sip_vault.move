module stride_contracts::sip_vault {
    use std::signer;
    use std::vector;
    use std::option;
    use std::string::{Self, String};
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    /// Error codes
    /// User is not authorized to perform this action
    const E_NOT_AUTHORIZED: u64 = 1;
    /// Insufficient balance in the vault
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    /// SIP is not due for execution yet
    const E_SIP_NOT_DUE: u64 = 3;
    /// SIP not found at the given index
    const E_SIP_NOT_FOUND: u64 = 4;
    /// SIP is already paused
    const E_SIP_ALREADY_PAUSED: u64 = 5;
    /// SIP is not paused
    const E_SIP_NOT_PAUSED: u64 = 6;
    /// Invalid amount provided
    const E_INVALID_AMOUNT: u64 = 7;
    /// Invalid frequency provided
    const E_INVALID_FREQUENCY: u64 = 8;

    /// The Vault resource, stored in a sticky Object.
    /// This object holds the SIP configuration and controls the funds.
    struct Vault has key {
        owner: address,
        sips: vector<SIPPlan>,
        /// Ref to extend capabilities (e.g. to create signer for the object)
        extend_ref: ExtendRef,
        /// Total amount deposited over time (for analytics)
        total_deposited: u64,
        /// Total amount invested through SIPs (for analytics)
        total_invested: u64,
        /// Creation timestamp
        created_at: u64,
    }

    /// Struct defining a SIP Plan
    struct SIPPlan has store, drop, copy {
        id: u64,
        target_asset: Object<Metadata>, // The asset to buy (e.g. APT metadata object)
        amount_in: u64,                 // Amount of input asset to spend
        frequency_seconds: u64,
        last_executed: u64,
        active: bool,
        /// Total amount invested through this SIP
        total_invested: u64,
        /// Total amount received through this SIP
        total_received: u64,
        /// Number of successful executions
        execution_count: u64,
        /// Creation timestamp
        created_at: u64,
        /// Name/label for the SIP
        name: String,
    }

    /// DCA Statistics for a SIP
    struct DCAStatistics has drop {
        total_invested: u64,
        total_received: u64,
        execution_count: u64,
        average_price: u64, // Average price paid (total_invested * 10^8 / total_received)
        next_execution: u64,
        is_active: bool,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct VaultCreated has drop, store {
        user: address,
        vault_addr: address,
        timestamp: u64,
    }

    #[event]
    struct SIPCreated has drop, store {
        user: address,
        vault_addr: address,
        sip_id: u64,
        amount_in: u64,
        frequency_seconds: u64,
        target_asset: address,
        name: String,
        timestamp: u64,
    }

    #[event]
    struct DepositEvent has drop, store {
        vault_addr: address,
        user: address,
        amount: u64,
        asset: address,
        timestamp: u64,
    }

    #[event]
    struct SIPExecuted has drop, store {
        vault_addr: address,
        sip_id: u64,
        amount_in: u64,
        amount_out: u64,
        execution_count: u64,
        timestamp: u64,
    }

    #[event]
    struct SIPUpdated has drop, store {
        vault_addr: address,
        sip_id: u64,
        old_amount: u64,
        new_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct SIPPaused has drop, store {
        vault_addr: address,
        sip_id: u64,
        timestamp: u64,
    }

    #[event]
    struct SIPResumed has drop, store {
        vault_addr: address,
        sip_id: u64,
        timestamp: u64,
    }

    #[event]
    struct SIPCancelled has drop, store {
        vault_addr: address,
        sip_id: u64,
        total_invested: u64,
        total_received: u64,
        timestamp: u64,
    }

    #[event]
    struct WithdrawalEvent has drop, store {
        vault_addr: address,
        user: address,
        amount: u64,
        asset: address,
        timestamp: u64,
    }

    // ============================================================================
    // ENTRY FUNCTIONS
    // ============================================================================

    /// Create a new Vault Object for the user.
    /// This vault will hold the assets to be invested.
    public entry fun create_vault(user: &signer) {
        let user_addr = signer::address_of(user);
        let now = timestamp::now_seconds();
        
        // Create a sticky object (non-deletable)
        let constructor_ref = object::create_object(user_addr);
        let object_signer = object::generate_signer(&constructor_ref);
        let vault_addr = signer::address_of(&object_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Initialize Vault resource
        move_to(&object_signer, Vault {
            owner: user_addr,
            sips: vector::empty(),
            extend_ref,
            total_deposited: 0,
            total_invested: 0,
            created_at: now,
        });

        event::emit(VaultCreated {
            user: user_addr,
            vault_addr,
            timestamp: now,
        });
    }

    /// Deposit funds into the vault.
    /// Transfers FA from user's primary store to the Vault Object's primary store.
    public entry fun deposit<AssetType: key>(
        user: &signer,
        vault_obj: Object<Vault>,
        amount: u64
    ) acquires Vault {
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        // Only owner can deposit via this function
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);
        
        // Get metadata for the CoinType
        let asset_metadata_opt = aptos_framework::coin::paired_metadata<AssetType>();
        let asset_metadata = option::destroy_some(asset_metadata_opt);
        let asset_addr = object::object_address(&asset_metadata);
        
        // Withdraw FA from user
        let fa = primary_fungible_store::withdraw(user, asset_metadata, amount);
        
        // Deposit to vault
        primary_fungible_store::deposit(vault_addr, fa);
        
        // Update vault stats
        vault.total_deposited = vault.total_deposited + amount;
        
        let now = timestamp::now_seconds();
        event::emit(DepositEvent {
            vault_addr,
            user: user_addr,
            amount,
            asset: asset_addr,
            timestamp: now,
        });
    }

    /// Deposit funds into the vault on behalf of a user (e.g. from Treasury).
    /// This allows the Treasury to fund the vault after a Fiat payment.
    public entry fun deposit_for_user<AssetType: key>(
        treasury: &signer,
        vault_obj: Object<Vault>,
        amount: u64
    ) acquires Vault {
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let treasury_addr = signer::address_of(treasury);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        // Get metadata for the CoinType
        let asset_metadata_opt = aptos_framework::coin::paired_metadata<AssetType>();
        let asset_metadata = option::destroy_some(asset_metadata_opt);
        let asset_addr = object::object_address(&asset_metadata);
        
        // Withdraw FA from Treasury
        let fa = primary_fungible_store::withdraw(treasury, asset_metadata, amount);
        
        // Deposit to vault
        primary_fungible_store::deposit(vault_addr, fa);
        
        // Update vault stats
        vault.total_deposited = vault.total_deposited + amount;
        
        let now = timestamp::now_seconds();
        event::emit(DepositEvent {
            vault_addr,
            user: vault.owner, // Event attributed to the vault owner
            amount,
            asset: asset_addr,
            timestamp: now,
        });
    }

    /// Create a new SIP in the vault
    public entry fun create_sip(
        user: &signer,
        vault_obj: Object<Vault>,
        target_asset: Object<Metadata>,
        amount_in: u64,
        frequency_seconds: u64,
        name: String
    ) acquires Vault {
        assert!(amount_in > 0, E_INVALID_AMOUNT);
        assert!(frequency_seconds >= 60, E_INVALID_FREQUENCY); // Minimum 1 minute
        
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        let now = timestamp::now_seconds();

        // Only owner can add SIPs
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);

        let sip_id = vector::length(&vault.sips);
        let target_asset_addr = object::object_address(&target_asset);
        
        let plan = SIPPlan {
            id: sip_id,
            target_asset,
            amount_in,
            frequency_seconds,
            last_executed: 0,
            active: true,
            total_invested: 0,
            total_received: 0,
            execution_count: 0,
            created_at: now,
            name,
        };
        vector::push_back(&mut vault.sips, plan);

        event::emit(SIPCreated {
            user: user_addr,
            vault_addr,
            sip_id,
            amount_in,
            frequency_seconds,
            target_asset: target_asset_addr,
            name,
            timestamp: now,
        });
    }

    /// Update the amount for an existing SIP (DCA amount adjustment)
    public entry fun update_sip_amount(
        user: &signer,
        vault_obj: Object<Vault>,
        sip_index: u64,
        new_amount: u64
    ) acquires Vault {
        assert!(new_amount > 0, E_INVALID_AMOUNT);
        
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        // Only owner can update SIPs
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        
        let sip = vector::borrow_mut(&mut vault.sips, sip_index);
        let old_amount = sip.amount_in;
        sip.amount_in = new_amount;
        
        let now = timestamp::now_seconds();
        event::emit(SIPUpdated {
            vault_addr,
            sip_id: sip_index,
            old_amount,
            new_amount,
            timestamp: now,
        });
    }

    /// Pause a SIP
    public entry fun pause_sip(
        user: &signer,
        vault_obj: Object<Vault>,
        sip_index: u64
    ) acquires Vault {
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        // Only owner can pause SIPs
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        
        let sip = vector::borrow_mut(&mut vault.sips, sip_index);
        assert!(sip.active, E_SIP_ALREADY_PAUSED);
        
        sip.active = false;
        
        let now = timestamp::now_seconds();
        event::emit(SIPPaused {
            vault_addr,
            sip_id: sip_index,
            timestamp: now,
        });
    }

    /// Resume a paused SIP
    public entry fun resume_sip(
        user: &signer,
        vault_obj: Object<Vault>,
        sip_index: u64
    ) acquires Vault {
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        // Only owner can resume SIPs
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        
        let sip = vector::borrow_mut(&mut vault.sips, sip_index);
        assert!(!sip.active, E_SIP_NOT_PAUSED);
        
        sip.active = true;
        // Reset last_executed to allow immediate execution if desired
        sip.last_executed = 0;
        
        let now = timestamp::now_seconds();
        event::emit(SIPResumed {
            vault_addr,
            sip_id: sip_index,
            timestamp: now,
        });
    }

    /// Cancel/delete a SIP
    public entry fun cancel_sip(
        user: &signer,
        vault_obj: Object<Vault>,
        sip_index: u64
    ) acquires Vault {
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        // Only owner can cancel SIPs
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        
        let sip = vector::borrow(&vault.sips, sip_index);
        let total_invested = sip.total_invested;
        let total_received = sip.total_received;
        
        // Remove the SIP (swap and pop for efficiency)
        let _ = vector::swap_remove(&mut vault.sips, sip_index);
        
        let now = timestamp::now_seconds();
        event::emit(SIPCancelled {
            vault_addr,
            sip_id: sip_index,
            total_invested,
            total_received,
            timestamp: now,
        });
    }

    /// Withdraw funds from the vault
    public entry fun withdraw<AssetType: key>(
        user: &signer,
        vault_obj: Object<Vault>,
        amount: u64
    ) acquires Vault {
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        
        // Only owner can withdraw
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);
        
        // Get metadata for the CoinType
        let asset_metadata_opt = aptos_framework::coin::paired_metadata<AssetType>();
        let asset_metadata = option::destroy_some(asset_metadata_opt);
        let asset_addr = object::object_address(&asset_metadata);
        
        // Generate signer for the vault object to withdraw
        let object_signer = object::generate_signer_for_extending(&vault.extend_ref);
        
        // Withdraw from vault's primary store
        let fa = primary_fungible_store::withdraw(&object_signer, asset_metadata, amount);
        
        // Deposit to user
        primary_fungible_store::deposit(user_addr, fa);
        
        let now = timestamp::now_seconds();
        event::emit(WithdrawalEvent {
            vault_addr,
            user: user_addr,
            amount,
            asset: asset_addr,
            timestamp: now,
        });
    }

    // ============================================================================
    // PUBLIC FUNCTIONS (for executor module)
    // ============================================================================

    /// Withdraw funds for execution.
    /// This function is called by the executor module to withdraw funds for SIP execution.
    public fun withdraw_for_execution(
        vault_obj: Object<Vault>,
        sip_index: u64,
        input_asset: Object<Metadata>
    ): fungible_asset::FungibleAsset acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        let sip = vector::borrow_mut(&mut vault.sips, sip_index);

        assert!(sip.active, E_SIP_NOT_DUE);
        
        let now = timestamp::now_seconds();
        // Allow execution if enough time passed OR if it's the first time (last_executed == 0)
        if (sip.last_executed != 0) {
            assert!(now >= sip.last_executed + sip.frequency_seconds, E_SIP_NOT_DUE);
        };

        // Update state
        sip.last_executed = now;

        // Generate signer for the vault object to withdraw
        let object_signer = object::generate_signer_for_extending(&vault.extend_ref);
        
        // Withdraw from vault's primary store
        primary_fungible_store::withdraw(&object_signer, input_asset, sip.amount_in)
    }

    /// Update SIP statistics after execution
    public fun update_sip_after_execution(
        vault_obj: Object<Vault>,
        sip_index: u64,
        amount_in: u64,
        amount_out: u64
    ) acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
        
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        let sip = vector::borrow_mut(&mut vault.sips, sip_index);
        
        sip.total_invested = sip.total_invested + amount_in;
        sip.total_received = sip.total_received + amount_out;
        sip.execution_count = sip.execution_count + 1;
        
        // Update vault total invested
        vault.total_invested = vault.total_invested + amount_in;
        
        let now = timestamp::now_seconds();
        event::emit(SIPExecuted {
            vault_addr,
            sip_id: sip_index,
            amount_in,
            amount_out,
            execution_count: sip.execution_count,
            timestamp: now,
        });
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get DCA statistics for a specific SIP
    public fun get_dca_statistics(
        vault_obj: Object<Vault>,
        sip_index: u64
    ): DCAStatistics acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        let sip = vector::borrow(&vault.sips, sip_index);
        
        let now = timestamp::now_seconds();
        let next_execution = if (sip.last_executed == 0) {
            now // Can execute immediately
        } else {
            sip.last_executed + sip.frequency_seconds
        };
        
        // Calculate average price (scaled by 10^8 for precision)
        let average_price = if (sip.total_received > 0) {
            (sip.total_invested * 100000000) / sip.total_received
        } else {
            0
        };
        
        DCAStatistics {
            total_invested: sip.total_invested,
            total_received: sip.total_received,
            execution_count: sip.execution_count,
            average_price,
            next_execution,
            is_active: sip.active,
        }
    }

    #[view]
    /// Get vault owner
    public fun get_vault_owner(vault_obj: Object<Vault>): address acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        vault.owner
    }

    #[view]
    /// Get number of SIPs in vault
    public fun get_sip_count(vault_obj: Object<Vault>): u64 acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        vector::length(&vault.sips)
    }

    #[view]
    /// Get vault statistics
    public fun get_vault_stats(vault_obj: Object<Vault>): (u64, u64, u64, u64) acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        (
            vault.total_deposited,
            vault.total_invested,
            vector::length(&vault.sips),
            vault.created_at
        )
    }

    #[view]
    /// Check if SIP is due for execution
    public fun is_sip_due(vault_obj: Object<Vault>, sip_index: u64): bool acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        
        if (sip_index >= vector::length(&vault.sips)) {
            return false
        };
        
        let sip = vector::borrow(&vault.sips, sip_index);
        
        if (!sip.active) {
            return false
        };
        
        let now = timestamp::now_seconds();
        if (sip.last_executed == 0) {
            return true
        };
        
        now >= sip.last_executed + sip.frequency_seconds
    }

    #[view]
    /// Get SIP details
    public fun get_sip_details(vault_obj: Object<Vault>, sip_index: u64): (u64, u64, u64, bool, String) acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global<Vault>(vault_addr);
        
        assert!(sip_index < vector::length(&vault.sips), E_SIP_NOT_FOUND);
        let sip = vector::borrow(&vault.sips, sip_index);
        
        (
            sip.amount_in,
            sip.frequency_seconds,
            sip.execution_count,
            sip.active,
            sip.name
        )
    }
}
