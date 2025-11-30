script {
    use stride_protocol::access_control;

    /// Initialize the Stride platform on testnet
    /// This script should be run once by the admin account
    fun init_platform(admin: &signer) {
        // 1. Initialize access control (RBAC system)
        access_control::initialize(admin);
        
        // Note: Rewards are registered per-user via rewards::register()
        // Note: Vaults are created per-user via sip_vault::create_vault()
        // Note: Treasury and Scheduler operators should be added via separate transactions:
        //   - access_control::add_treasury_operator(admin, treasury_addr)
        //   - access_control::add_scheduler_operator(admin, scheduler_addr)
    }
}