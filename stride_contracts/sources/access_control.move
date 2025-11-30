module stride_protocol::access_control {
    use std::signer;
    use std::vector;
    use std::error;
    use aptos_framework::event;

    // Error codes
    /// Caller is not authorized for this operation
    const ENOT_AUTHORIZED: u64 = 1;
    /// System is currently paused
    const ESYSTEM_PAUSED: u64 = 2;
    /// Invalid role assignment
    const EINVALID_ROLE: u64 = 3;
    /// Already initialized
    const EALREADY_INITIALIZED: u64 = 4;

    // Role definitions
    const ROLE_ADMIN: u64 = 1;
    const ROLE_TREASURY: u64 = 2;
    const ROLE_SCHEDULER: u64 = 3;

    // Global access control state
    struct AccessControl has key {
        admin: address,
        treasury_operators: vector<address>,
        scheduler_operators: vector<address>,
        paused: bool,
    }

    #[event]
    struct RoleGranted has drop, store {
        role: u64,
        account: address,
        granter: address,
    }

    #[event]
    struct RoleRevoked has drop, store {
        role: u64,
        account: address,
        revoker: address,
    }

    #[event]
    struct SystemPaused has drop, store {
        pauser: address,
        timestamp: u64,
    }

    #[event]
    struct SystemUnpaused has drop, store {
        unpauser: address,
        timestamp: u64,
    }

    // Initialize access control (called once during deployment)
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        assert!(
            !exists<AccessControl>(admin_addr),
            error::already_exists(EALREADY_INITIALIZED)
        );

        move_to(admin, AccessControl {
            admin: admin_addr,
            treasury_operators: vector::empty(),
            scheduler_operators: vector::empty(),
            paused: false,
        });
    }

    // Add treasury operator
    public entry fun add_treasury_operator(
        admin: &signer,
        operator: address
    ) acquires AccessControl {
        let admin_addr = signer::address_of(admin);
        let ac = borrow_global_mut<AccessControl>(admin_addr);
        
        assert!(
            ac.admin == admin_addr,
            error::permission_denied(ENOT_AUTHORIZED)
        );

        if (!vector::contains(&ac.treasury_operators, &operator)) {
            vector::push_back(&mut ac.treasury_operators, operator);
            
            event::emit(RoleGranted {
                role: ROLE_TREASURY,
                account: operator,
                granter: admin_addr,
            });
        };
    }

    // Add scheduler operator
    public entry fun add_scheduler_operator(
        admin: &signer,
        operator: address
    ) acquires AccessControl {
        let admin_addr = signer::address_of(admin);
        let ac = borrow_global_mut<AccessControl>(admin_addr);
        
        assert!(
            ac.admin == admin_addr,
            error::permission_denied(ENOT_AUTHORIZED)
        );

        if (!vector::contains(&ac.scheduler_operators, &operator)) {
            vector::push_back(&mut ac.scheduler_operators, operator);
            
            event::emit(RoleGranted {
                role: ROLE_SCHEDULER,
                account: operator,
                granter: admin_addr,
            });
        };
    }

    // Remove treasury operator
    public entry fun remove_treasury_operator(
        admin: &signer,
        operator: address
    ) acquires AccessControl {
        let admin_addr = signer::address_of(admin);
        let ac = borrow_global_mut<AccessControl>(admin_addr);
        
        assert!(
            ac.admin == admin_addr,
            error::permission_denied(ENOT_AUTHORIZED)
        );

        let (found, index) = vector::index_of(&ac.treasury_operators, &operator);
        if (found) {
            vector::remove(&mut ac.treasury_operators, index);
            
            event::emit(RoleRevoked {
                role: ROLE_TREASURY,
                account: operator,
                revoker: admin_addr,
            });
        };
    }

    // Remove scheduler operator
    public entry fun remove_scheduler_operator(
        admin: &signer,
        operator: address
    ) acquires AccessControl {
        let admin_addr = signer::address_of(admin);
        let ac = borrow_global_mut<AccessControl>(admin_addr);
        
        assert!(
            ac.admin == admin_addr,
            error::permission_denied(ENOT_AUTHORIZED)
        );

        let (found, index) = vector::index_of(&ac.scheduler_operators, &operator);
        if (found) {
            vector::remove(&mut ac.scheduler_operators, index);
            
            event::emit(RoleRevoked {
                role: ROLE_SCHEDULER,
                account: operator,
                revoker: admin_addr,
            });
        };
    }

    // Emergency pause
    public entry fun pause(admin: &signer) acquires AccessControl {
        let admin_addr = signer::address_of(admin);
        let ac = borrow_global_mut<AccessControl>(admin_addr);
        
        assert!(
            ac.admin == admin_addr,
            error::permission_denied(ENOT_AUTHORIZED)
        );

        ac.paused = true;
        
        event::emit(SystemPaused {
            pauser: admin_addr,
            timestamp: aptos_framework::timestamp::now_seconds(),
        });
    }

    // Resume operations
    public entry fun unpause(admin: &signer) acquires AccessControl {
        let admin_addr = signer::address_of(admin);
        let ac = borrow_global_mut<AccessControl>(admin_addr);
        
        assert!(
            ac.admin == admin_addr,
            error::permission_denied(ENOT_AUTHORIZED)
        );

        ac.paused = false;
        
        event::emit(SystemUnpaused {
            unpauser: admin_addr,
            timestamp: aptos_framework::timestamp::now_seconds(),
        });
    }

    // View functions
    #[view]
    public fun is_admin(admin_addr: address, account: address): bool acquires AccessControl {
        if (!exists<AccessControl>(admin_addr)) {
            return false
        };
        
        let ac = borrow_global<AccessControl>(admin_addr);
        ac.admin == account
    }

    #[view]
    public fun is_treasury_operator(admin_addr: address, account: address): bool acquires AccessControl {
        if (!exists<AccessControl>(admin_addr)) {
            return false
        };
        
        let ac = borrow_global<AccessControl>(admin_addr);
        vector::contains(&ac.treasury_operators, &account)
    }

    #[view]
    public fun is_scheduler_operator(admin_addr: address, account: address): bool acquires AccessControl {
        if (!exists<AccessControl>(admin_addr)) {
            return false
        };
        
        let ac = borrow_global<AccessControl>(admin_addr);
        vector::contains(&ac.scheduler_operators, &account)
    }

    #[view]
    public fun is_paused(admin_addr: address): bool acquires AccessControl {
        if (!exists<AccessControl>(admin_addr)) {
            return false
        };
        
        let ac = borrow_global<AccessControl>(admin_addr);
        ac.paused
    }

    // Internal verification functions (for use by other modules)
    public fun verify_treasury_operator(admin_addr: address, operator: &signer) acquires AccessControl {
        let operator_addr = signer::address_of(operator);
        assert!(
            is_treasury_operator(admin_addr, operator_addr),
            error::permission_denied(ENOT_AUTHORIZED)
        );
    }

    public fun verify_scheduler_operator(admin_addr: address, scheduler: &signer) acquires AccessControl {
        let scheduler_addr = signer::address_of(scheduler);
        assert!(
            is_scheduler_operator(admin_addr, scheduler_addr),
            error::permission_denied(ENOT_AUTHORIZED)
        );
    }

    public fun verify_not_paused(admin_addr: address) acquires AccessControl {
        assert!(
            !is_paused(admin_addr),
            error::invalid_state(ESYSTEM_PAUSED)
        );
    }

    #[test_only]
    public fun initialize_for_test(admin: &signer) {
        initialize(admin);
    }
}