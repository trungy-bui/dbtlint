{% macro normalize_int(field) %}
    {{ return("cast(round(" ~ field ~ ") as integer)") }}
{% endmacro %}
