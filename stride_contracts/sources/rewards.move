module stride_protocol::rewards {
    use std::signer;
    use std::string::String;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    /// Error codes
    /// User already has a reward store
    const E_ALREADY_REGISTERED: u64 = 1;
    /// User does not have a reward store
    const E_NOT_REGISTERED: u64 = 2;
    /// Insufficient points for redemption
    const E_INSUFFICIENT_POINTS: u64 = 3;
    /// Invalid amount
    const E_INVALID_AMOUNT: u64 = 4;

    /// Reward tiers for DCA achievements
    const TIER_BRONZE: u64 = 1000;      // 1,000 points
    const TIER_SILVER: u64 = 5000;      // 5,000 points
    const TIER_GOLD: u64 = 25000;       // 25,000 points
    const TIER_PLATINUM: u64 = 100000;  // 100,000 points
    const TIER_DIAMOND: u64 = 500000;   // 500,000 points

    struct RewardStore has key {
        points: u64,
        total_earned: u64,
        total_redeemed: u64,
        sip_executions: u64,
        streak_days: u64,
        last_activity: u64,
        tier: u64,
        created_at: u64,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct RewardStoreCreated has drop, store {
        user: address,
        timestamp: u64,
    }

    #[event]
    struct PointsAdded has drop, store {
        user: address,
        amount: u64,
        source: String,
        new_total: u64,
        timestamp: u64,
    }

    #[event]
    struct PointsRedeemed has drop, store {
        user: address,
        amount: u64,
        redemption_type: String,
        remaining: u64,
        timestamp: u64,
    }

    #[event]
    struct TierUpgrade has drop, store {
        user: address,
        old_tier: u64,
        new_tier: u64,
        total_points: u64,
        timestamp: u64,
    }

    #[event]
    struct StreakUpdated has drop, store {
        user: address,
        new_streak: u64,
        bonus_points: u64,
        timestamp: u64,
    }

    #[event]
    struct RewardDistributed has drop, store {
        user: address,
        amount: u64,
        sip_amount: u64,
        vault_addr: address,
        timestamp: u64,
    }

    // ============================================================================
    // ENTRY FUNCTIONS
    // ============================================================================

    /// Initialize rewards for a user
    public entry fun register(user: &signer) {
        let user_addr = signer::address_of(user);
        let now = timestamp::now_seconds();
        
        if (!exists<RewardStore>(user_addr)) {
            move_to(user, RewardStore { 
                points: 0,
                total_earned: 0,
                total_redeemed: 0,
                sip_executions: 0,
                streak_days: 0,
                last_activity: now,
                tier: 0,
                created_at: now,
            });
            
            event::emit(RewardStoreCreated {
                user: user_addr,
                timestamp: now,
            });
        }
    }

    /// Redeem points for rewards
    public entry fun redeem_points(
        user: &signer,
        amount: u64,
        redemption_type: String
    ) acquires RewardStore {
        let user_addr = signer::address_of(user);
        assert!(exists<RewardStore>(user_addr), E_NOT_REGISTERED);
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let store = borrow_global_mut<RewardStore>(user_addr);
        assert!(store.points >= amount, E_INSUFFICIENT_POINTS);
        
        store.points = store.points - amount;
        store.total_redeemed = store.total_redeemed + amount;
        
        let now = timestamp::now_seconds();
        event::emit(PointsRedeemed {
            user: user_addr,
            amount,
            redemption_type,
            remaining: store.points,
            timestamp: now,
        });
    }

    // ============================================================================
    // PUBLIC FUNCTIONS (for other modules)
    // ============================================================================

    /// Add points to a user
    /// Called by executor module after SIP execution
    public fun add_points(user_addr: address, amount: u64) acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            // Can't auto-initialize without signer
            // Just emit an event and return
            return
        };
        
        if (amount == 0) {
            return
        };

        let store = borrow_global_mut<RewardStore>(user_addr);
        let old_tier = store.tier;
        
        store.points = store.points + amount;
        store.total_earned = store.total_earned + amount;
        store.sip_executions = store.sip_executions + 1;
        
        let now = timestamp::now_seconds();
        store.last_activity = now;
        
        // Calculate new tier based on total earned
        let new_tier = calculate_tier(store.total_earned);
        
        // Emit points added event
        event::emit(PointsAdded {
            user: user_addr,
            amount,
            source: std::string::utf8(b"sip_execution"),
            new_total: store.points,
            timestamp: now,
        });
        
        // Check for tier upgrade
        if (new_tier > old_tier) {
            store.tier = new_tier;
            event::emit(TierUpgrade {
                user: user_addr,
                old_tier,
                new_tier,
                total_points: store.total_earned,
                timestamp: now,
            });
        }
    }

    /// Add points with custom source
    public fun add_points_with_source(
        user_addr: address, 
        amount: u64,
        source: String
    ) acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            return
        };
        
        if (amount == 0) {
            return
        };

        let store = borrow_global_mut<RewardStore>(user_addr);
        store.points = store.points + amount;
        store.total_earned = store.total_earned + amount;
        
        let now = timestamp::now_seconds();
        store.last_activity = now;
        
        event::emit(PointsAdded {
            user: user_addr,
            amount,
            source,
            new_total: store.points,
            timestamp: now,
        });
    }

    /// Add streak bonus
    public fun add_streak_bonus(user_addr: address) acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            return
        };

        let store = borrow_global_mut<RewardStore>(user_addr);
        let now = timestamp::now_seconds();
        
        // Check if it's a new day (24 hours since last activity)
        let day_seconds = 86400;
        if (now > store.last_activity + day_seconds) {
            // Check if within streak window (48 hours)
            if (now < store.last_activity + (2 * day_seconds)) {
                store.streak_days = store.streak_days + 1;
            } else {
                // Streak broken, reset
                store.streak_days = 1;
            }
        };
        
        // Calculate streak bonus (10 points per streak day, max 100)
        let bonus = if (store.streak_days > 10) { 100 } else { store.streak_days * 10 };
        
        if (bonus > 0) {
            store.points = store.points + bonus;
            store.total_earned = store.total_earned + bonus;
            
            event::emit(StreakUpdated {
                user: user_addr,
                new_streak: store.streak_days,
                bonus_points: bonus,
                timestamp: now,
            });
        };
        
        store.last_activity = now;
    }

    /// Emit a reward distributed event (for tracking)
    public fun emit_reward_distributed(
        user_addr: address,
        amount: u64,
        sip_amount: u64,
        vault_addr: address
    ) {
        let now = timestamp::now_seconds();
        event::emit(RewardDistributed {
            user: user_addr,
            amount,
            sip_amount,
            vault_addr,
            timestamp: now,
        });
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get user's current points
    public fun get_points(user_addr: address): u64 acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            return 0
        };
        borrow_global<RewardStore>(user_addr).points
    }

    #[view]
    /// Get user's reward statistics
    public fun get_reward_stats(user_addr: address): (u64, u64, u64, u64, u64, u64) acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            return (0, 0, 0, 0, 0, 0)
        };
        
        let store = borrow_global<RewardStore>(user_addr);
        (
            store.points,
            store.total_earned,
            store.total_redeemed,
            store.sip_executions,
            store.streak_days,
            store.tier
        )
    }

    #[view]
    /// Get user's tier
    public fun get_tier(user_addr: address): u64 acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            return 0
        };
        borrow_global<RewardStore>(user_addr).tier
    }

    #[view]
    /// Get points needed for next tier
    public fun get_points_to_next_tier(user_addr: address): u64 acquires RewardStore {
        if (!exists<RewardStore>(user_addr)) {
            return TIER_BRONZE
        };
        
        let store = borrow_global<RewardStore>(user_addr);
        let total = store.total_earned;
        
        if (total < TIER_BRONZE) {
            TIER_BRONZE - total
        } else if (total < TIER_SILVER) {
            TIER_SILVER - total
        } else if (total < TIER_GOLD) {
            TIER_GOLD - total
        } else if (total < TIER_PLATINUM) {
            TIER_PLATINUM - total
        } else if (total < TIER_DIAMOND) {
            TIER_DIAMOND - total
        } else {
            0 // Already at max tier
        }
    }

    #[view]
    /// Check if user has reward store
    public fun is_registered(user_addr: address): bool {
        exists<RewardStore>(user_addr)
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Calculate tier based on total earned points
    fun calculate_tier(total_earned: u64): u64 {
        if (total_earned >= TIER_DIAMOND) {
            5 // Diamond
        } else if (total_earned >= TIER_PLATINUM) {
            4 // Platinum
        } else if (total_earned >= TIER_GOLD) {
            3 // Gold
        } else if (total_earned >= TIER_SILVER) {
            2 // Silver
        } else if (total_earned >= TIER_BRONZE) {
            1 // Bronze
        } else {
            0 // No tier
        }
    }
}
