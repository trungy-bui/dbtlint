{% macro generate_surrogate_key(fields) %}
    {{ return(adapter.dispatch("generate_surrogate_key", "dbt_utils")(fields)) }}
{% endmacro %}

{% macro default__generate_surrogate_key(fields) %}
    {{ return(fields | join(" || ")) }}
{% endmacro %}
