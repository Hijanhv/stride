module stride_contracts::rewards {
    use std::signer;
    use aptos_framework::event;

    struct RewardStore has key {
        points: u64,
    }

    #[event]
    struct PointsAdded has drop, store {
        user: address,
        amount: u64,
        new_total: u64,
    }

    /// Add points to a user
    /// In production, this should be restricted to authorized modules (friend).
    public fun add_points(user_addr: address, amount: u64) acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            // We can't move_to a user without their signer.
            // So we can't auto-initialize rewards for an arbitrary address unless they called a setup function.
            // For now, we'll just emit an event if store doesn't exist, or skip.
            // Better: The user should initialize their reward store when they create their first SIP.
            return
        };

        let store = borrow_global_mut<RewardStore>(user_addr);
        store.points = store.points + amount;

        event::emit(PointsAdded {
            user: user_addr,
            amount,
            new_total: store.points,
        });
    }

    /// Initialize rewards for a user
    public entry fun register(user: &signer) {
        if (!exists<RewardStore>(signer::address_of(user))) {
            move_to(user, RewardStore { points: 0 });
        }
    }
}
