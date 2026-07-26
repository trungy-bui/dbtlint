{% macro level_one(field) %}
    {{ return(level_two(field)) }}
{% endmacro %}

{% macro level_two(field) %}
    {{ return(level_three(field)) }}
{% endmacro %}

{% macro level_three(field) %}
    {{ return("coalesce(" ~ field ~ ", 0)") }}
{% endmacro %}
