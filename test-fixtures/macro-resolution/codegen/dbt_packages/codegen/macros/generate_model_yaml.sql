{% macro generate_model_yaml(model_names) %}
    {{ return(model_names | join(",")) }}
{% endmacro %}
