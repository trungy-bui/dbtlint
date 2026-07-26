{% macro compare_all_columns(a_relation, b_relation) %}
    {{ return(a_relation ~ " union all " ~ b_relation) }}
{% endmacro %}
