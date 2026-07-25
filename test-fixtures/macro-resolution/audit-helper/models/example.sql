select *
from {{ audit_helper.compare_all_columns(
    a_relation=ref("actors"),
    b_relation=ref("expected_actors")
) }}
