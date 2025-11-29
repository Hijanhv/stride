module Decibel::dex_accounts {
    use std::option::{Option};

    public fun place_order_to_subaccount(
        _signer: &signer,
        _subaccount: address,
        _market: address,
        _price: u64,
        _size: u64,
        _is_buy: bool,
        _time_in_force: u8,
        _reduce_only: bool,
        _client_order_id: Option<u128>,
        _stop_price: Option<u64>,
        _tp_trigger_price: Option<u64>,
        _tp_limit_price: Option<u64>,
        _sl_trigger_price: Option<u64>,
        _sl_limit_price: Option<u64>,
        _builder_addr: Option<address>,
        _builder_fee: Option<u64>
    ) {
        // Interface only
    }
}
