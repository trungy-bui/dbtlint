{% macro postgres__fixture_surrogate_key(fields) %}
    {{ return(dbt_utils.generate_surrogate_key(fields)) }}
{% endmacro %}
