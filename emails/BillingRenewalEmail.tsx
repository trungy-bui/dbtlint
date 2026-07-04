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

type BillingRenewalEmailProps = {
  billingUrl: string;
  planName?: string;
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
  backgroundColor: "#10b981",
  borderRadius: "6px",
  color: "#052e16",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  padding: "12px 18px",
  textDecoration: "none",
};

export function BillingRenewalEmail({
  billingUrl,
  planName = "Team",
}: BillingRenewalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your DBTLint subscription renewed successfully.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ ...mutedText, margin: "0 0 12px" }}>DBTLint</Text>
          <Heading style={{ fontSize: "28px", lineHeight: "34px", margin: 0 }}>
            Subscription renewed
          </Heading>
          <Text style={mutedText}>
            Your {planName} subscription renewed successfully. Your workspace
            remains active and ready for the next scan.
          </Text>
          <Button href={billingUrl} style={button}>
            View billing
          </Button>
          <Hr style={{ borderColor: "#27272a", margin: "32px 0 16px" }} />
          <Text style={{ ...mutedText, fontSize: "12px", margin: 0 }}>
            Thanks for building cleaner dbt projects with DBTLint.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BillingRenewalEmail;
