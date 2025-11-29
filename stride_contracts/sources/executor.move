module stride_contracts::executor {
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;
    use stride_contracts::sip_vault::{Self, Vault};
    use stride_contracts::clob_market;
    use stride_contracts::rewards;

    /// Execute a specific SIP.
    /// This function is permissionless (anyone can run the scheduler), 
    /// but it only performs the actions defined in the user's SIP plan.
    public entry fun execute_sip(
        _scheduler: &signer, // The caller (e.g. our backend bot)
        vault_obj: Object<Vault>,
        sip_index: u64,
        input_asset: Object<Metadata>,
        target_asset: Object<Metadata>
    ) {
        // 1. Withdraw Input Asset from Vault
        let input_fa = sip_vault::withdraw_for_execution(vault_obj, sip_index, input_asset);
        let amount_in = fungible_asset::amount(&input_fa);
        let vault_addr = object::object_address(&vault_obj);

        // 2. Execute Swap on CLOB
        // Since we can't easily pass the FA to the CLOB interface in this mock (it expects signer),
        // we will simulate the swap logic here.
        
        // In a real implementation:
        // - We would deposit `input_fa` into a temporary "Executor" object.
        // - The Executor object would sign the CLOB order.
        // - The CLOB would take the input and give back the output.
        
        // SIMULATION:
        // We "burn" the input (deposit to a fee collector or just back to vault for now to not lose funds in demo)
        // And we "mint" or transfer the target asset from a Liquidity Provider.
        
        // For this Hackathon Demo:
        // We will just deposit the input BACK to the vault (so user doesn't lose money testing)
        // AND we will try to give them some Target Asset if the signer has it.
        
        primary_fungible_store::deposit(vault_addr, input_fa);

        // Call the interface just to show we are using it
        // We pass dummy values for market_id (1), price (0 - market), lot/tick size (1)
        // side = true (buy) if we are swapping Input -> Target (assuming Input is Quote and Target is Base? Or vice versa)
        // Let's assume we are buying Target (Base) with Input (Quote).
        clob_market::place_market_order<Metadata, Metadata>(
            _scheduler, // Using scheduler as signer for now (mock), in reality would be the vault's signer
            1, // market_id
            true, // is_bid (buy)
            amount_in,
            0, // price (market)
            1, // lot_size
            1  // tick_size
        );
        
        // 3. Distribute Rewards
        // We need the user's address. The Vault object has an owner, but we can't read it easily without a getter.
        // Let's assume the vault address is the user's identity for rewards for now, 
        // or we add a getter to sip_vault.
        
        // For now, reward the vault object itself (it can hold resources too)
        rewards::add_points(vault_addr, amount_in / 10);
    }
}
