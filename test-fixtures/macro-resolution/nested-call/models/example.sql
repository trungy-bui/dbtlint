select
    {{ dbt_utils.level_one("actor_id") }} as nested_actor_key
from {{ ref("actors") }}
