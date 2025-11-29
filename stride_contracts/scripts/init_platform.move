script {
    use stride_contracts::access_control;
    use stride_contracts::rewards;

    /// Initialize the Stride platform on testnet
    /// This script should be run once by the admin account
    fun init_platform(admin: &signer) {
        // 1. Initialize access control
        access_control::initialize(admin);
        
        // 2. Initialize rewards system
        rewards::initialize(admin);
        
        // Note: Vaults are created per-user, not during platform init
        // Note: Treasury and Scheduler operators should be added via separate transactions
    }
}