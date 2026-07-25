select
    {{ dbt_expectations.expression_is_true("actor_id > 0") }} as is_valid
from {{ ref("actors") }}
