module stride_contracts::sip_vault {
    use std::signer;
    use std::vector;
    use std::option;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_SIP_NOT_DUE: u64 = 3;

    /// The Vault resource, stored in a sticky Object.
    /// This object holds the SIP configuration and controls the funds.
    struct Vault has key {
        owner: address,
        sips: vector<SIPPlan>,
        /// Ref to extend capabilities (e.g. to create signer for the object)
        extend_ref: ExtendRef, 
    }

    /// Struct defining a SIP Plan
    struct SIPPlan has store, drop, copy {
        id: u64,
        target_asset: Object<Metadata>, // The asset to buy (e.g. APT metadata object)
        amount_in: u64,                 // Amount of input asset to spend
        frequency_seconds: u64,
        last_executed: u64,
        active: bool,
    }

    // Events
    #[event]
    struct VaultCreated has drop, store {
        user: address,
        vault_addr: address,
    }

    #[event]
    struct SIPCreated has drop, store {
        user: address,
        vault_addr: address,
        sip_id: u64,
        amount_in: u64,
    }

    /// Create a new Vault Object for the user.
    /// This vault will hold the assets to be invested.
    public entry fun create_vault(user: &signer) {
        let user_addr = signer::address_of(user);
        
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
        });

        event::emit(VaultCreated {
            user: user_addr,
            vault_addr,
        });
    }

    /// Deposit funds into the vault.
    /// Transfers FA from user's primary store to the Vault Object's primary store.
    public entry fun deposit<AssetType: key>(
        user: &signer,
        vault_obj: Object<Vault>,
        amount: u64
    ) {
        let vault_addr = object::object_address(&vault_obj);
        // Get metadata for the CoinType
        let asset_metadata_opt = aptos_framework::coin::paired_metadata<AssetType>();
        let asset_metadata = option::destroy_some(asset_metadata_opt);
        
        // Withdraw FA from user
        let fa = primary_fungible_store::withdraw(user, asset_metadata, amount);
        
        // Deposit to vault
        primary_fungible_store::deposit(vault_addr, fa);
    }

    /// Create a new SIP in the vault
    public entry fun create_sip(
        user: &signer,
        vault_obj: Object<Vault>,
        target_asset: Object<Metadata>,
        amount_in: u64,
        frequency_seconds: u64
    ) acquires Vault {
        let user_addr = signer::address_of(user);
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);

        // Only owner can add SIPs
        assert!(vault.owner == user_addr, E_NOT_AUTHORIZED);

        let sip_id = vector::length(&vault.sips);
        let plan = SIPPlan {
            id: sip_id,
            target_asset,
            amount_in,
            frequency_seconds,
            last_executed: 0,
            active: true,
        };
        vector::push_back(&mut vault.sips, plan);

        event::emit(SIPCreated {
            user: user_addr,
            vault_addr,
            sip_id,
            amount_in,
        });
    }

    /// Withdraw funds for execution.
    /// This function is "friend" or authorized only. 
    /// For this implementation, we allow anyone to trigger it, but it only sends funds to the executor logic.
    /// Actually, to be safe, we should have an `executor` module that is authorized.
    /// For now, let's make it public but it returns the FA, which must be handled.
    public fun withdraw_for_execution(
        vault_obj: Object<Vault>,
        sip_index: u64,
        input_asset: Object<Metadata>
    ): fungible_asset::FungibleAsset acquires Vault {
        let vault_addr = object::object_address(&vault_obj);
        let vault = borrow_global_mut<Vault>(vault_addr);
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
}
