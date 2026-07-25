select
    {{ dbt_utils.generate_surrogate_key(
        [dbt_utils.get_single_value("select max(actor_id) from actors")]
    ) }} as nested_actor_key
