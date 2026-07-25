select
    {{ adapter.dispatch("generate_surrogate_key", "dbt_utils")(["actor_id"]) }}
        as actor_key
from {{ ref("actors") }}
