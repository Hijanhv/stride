module Decibel::dex_accounts {
    use std::option::{Option};
    use std::string::{String};

    /// Place a limit or market order on a specific market for a subaccount
    public entry fun place_order_to_subaccount(
        sender: &signer,
        subaccount_addr: address,
        market_addr: address,
        price: u64,
        size: u64,
        is_buy: bool,
        time_in_force: u8,
        reduce_only: bool,
        client_order_id: Option<u128>,
        stop_price: Option<u64>,
        tp_trigger_price: Option<u64>,
        tp_limit_price: Option<u64>,
        sl_trigger_price: Option<u64>,
        sl_limit_price: Option<u64>,
        builder_addr: Option<address>,
        builder_fee: Option<u64>
    ) {
        // Interface only - implementation is on-chain
    }
}
