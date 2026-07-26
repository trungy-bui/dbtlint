select
    {{ dbt_utils.generate_surrogate_key(["actor_id"]) }} as actor_key
from {{ ref("actors") }}
