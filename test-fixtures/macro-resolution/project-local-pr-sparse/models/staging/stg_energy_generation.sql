with generation as (
    select
        country,
        year,
        energy_source,
        generation_gwh
    from {{ ref("raw_energy_generation") }}
),

final as (
    select
        country,
        year,
        energy_source,
        generation_gwh
    from generation
)

select {{ format_int("generation_gwh") }} as generation_gwh
from final
