select
    {{ round_number("amount") }} as rounded_amount,
    {{ clamp_number("amount", 0, 100) }} as clamped_amount
from payments
