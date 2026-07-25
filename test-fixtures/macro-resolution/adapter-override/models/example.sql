select
    {{ adapter.dispatch("fixture_surrogate_key")(["actor_id"]) }} as actor_key
from {{ ref("actors") }}
