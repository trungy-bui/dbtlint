import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

type PaymentFailedEmailProps = {
  updatePaymentUrl: string;
};

const main = {
  backgroundColor: "#09090b",
  color: "#f4f4f5",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  margin: "40px auto",
  padding: "32px",
  width: "100%",
  maxWidth: "560px",
};

const mutedText = {
  color: "#a1a1aa",
  fontSize: "14px",
  lineHeight: "22px",
};

const button = {
  backgroundColor: "#f43f5e",
  borderRadius: "6px",
  color: "#fff1f2",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  padding: "12px 18px",
  textDecoration: "none",
};

export function PaymentFailedEmail({
  updatePaymentUrl,
}: PaymentFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>We could not process your DBTLint payment.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ ...mutedText, margin: "0 0 12px" }}>DBTLint</Text>
          <Heading style={{ fontSize: "28px", lineHeight: "34px", margin: 0 }}>
            Payment failed
          </Heading>
          <Text style={mutedText}>
            We could not process your latest payment. Update your payment method
            to keep your Team workspace active.
          </Text>
          <Button href={updatePaymentUrl} style={button}>
            Update payment info
          </Button>
          <Hr style={{ borderColor: "#27272a", margin: "32px 0 16px" }} />
          <Text style={{ ...mutedText, fontSize: "12px", margin: 0 }}>
            If you already updated your payment method, no further action is
            needed.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PaymentFailedEmail;
