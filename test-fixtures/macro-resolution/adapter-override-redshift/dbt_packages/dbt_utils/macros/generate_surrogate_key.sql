{% macro redshift__generate_surrogate_key(fields) %}
    {{ return("md5(" ~ fields | join(" || ") ~ ")") }}
{% endmacro %}
