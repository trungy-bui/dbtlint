{% macro format_int(field) %}
    {{ return("cast(round(" ~ field ~ ") as integer)") }}
{% endmacro %}
