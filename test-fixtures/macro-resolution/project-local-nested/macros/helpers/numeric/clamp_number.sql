{% macro clamp_number(field, minimum, maximum) %}
    {{ return("greatest(" ~ minimum ~ ", least(" ~ field ~ ", " ~ maximum ~ "))") }}
{% endmacro %}
