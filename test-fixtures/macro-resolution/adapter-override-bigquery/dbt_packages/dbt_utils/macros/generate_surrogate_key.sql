{% macro bigquery__generate_surrogate_key(fields) %}
    {{ return("to_hex(md5(concat(" ~ fields | join(", ") ~ ")))") }}
{% endmacro %}
