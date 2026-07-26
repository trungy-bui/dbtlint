{% macro generate_surrogate_key(fields) %}
    {{ return(fields | join(" || ")) }}
{% endmacro %}
