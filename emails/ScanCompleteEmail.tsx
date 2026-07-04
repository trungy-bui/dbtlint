import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type ScanCompleteEmailProps = {
  projectName: string;
  score: number;
  resultsUrl: string;
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

export function ScanCompleteEmail({
  projectName,
  score,
  resultsUrl,
}: ScanCompleteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your dbt project scan is complete.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ ...mutedText, margin: "0 0 12px" }}>DBTLint</Text>
          <Heading style={{ fontSize: "28px", lineHeight: "34px", margin: 0 }}>
            Scan complete
          </Heading>
          <Text style={mutedText}>
            Your scan for{" "}
            <strong style={{ color: "#f4f4f5" }}>{projectName}</strong> is done.
          </Text>
          <Section
            style={{
              backgroundColor: "#09090b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              margin: "24px 0",
              padding: "20px",
            }}
          >
            <Text style={{ ...mutedText, margin: "0 0 8px" }}>
              Project health score
            </Text>
            <Text
              style={{
                color: "#34d399",
                fontSize: "40px",
                fontWeight: "800",
                lineHeight: "44px",
                margin: 0,
              }}
            >
              {score}/100
            </Text>
          </Section>
          <Button href={resultsUrl} style={button}>
            View results
          </Button>
          <Hr style={{ borderColor: "#27272a", margin: "32px 0 16px" }} />
          <Text style={{ ...mutedText, fontSize: "12px", margin: 0 }}>
            Keep your analytics code sharp with every scan.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ScanCompleteEmail;
