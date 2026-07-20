import { isAllowedSnsSubscriptionUrl, isAllowedSnsUrl, snsStringToSign } from "./sns-verification";

describe("SNS callback verification", () => {
  it("allows only regional SNS certificate and confirmation URLs", () => {
    expect(
      isAllowedSnsUrl(
        "https://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService-abc.pem",
        "ap-southeast-1",
        "/SimpleNotificationService-",
      ),
    ).toBe(true);
    expect(
      isAllowedSnsUrl(
        "https://evil.example/SimpleNotificationService-abc.pem",
        "ap-southeast-1",
        "/SimpleNotificationService-",
      ),
    ).toBe(false);
    expect(
      isAllowedSnsSubscriptionUrl(
        "https://sns.ap-southeast-1.amazonaws.com/?Action=ConfirmSubscription&Token=x",
        "ap-southeast-1",
      ),
    ).toBe(true);
    expect(
      isAllowedSnsSubscriptionUrl(
        "https://sns.ap-southeast-1.amazonaws.com/?Action=GetTopicAttributes",
        "ap-southeast-1",
      ),
    ).toBe(false);
  });

  it("builds the canonical signature payload without accepting arbitrary fields", () => {
    expect(
      snsStringToSign({
        Type: "Notification",
        Message: "payload",
        MessageId: "id",
        Timestamp: "now",
        TopicArn: "arn",
        Signature: "ignored",
      }),
    ).toBe("Message\npayload\nMessageId\nid\nTimestamp\nnow\nTopicArn\narn\nType\nNotification\n");
  });
});
