{% macro snowflake__generate_surrogate_key(fields) %}
    {{ return("concat(" ~ fields | join(", ") ~ ")") }}
{% endmacro %}
