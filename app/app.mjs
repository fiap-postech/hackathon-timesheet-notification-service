import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const sesClient = new SESClient({ region: process.env.AWS_EXECUTION_REGION });
const s3Client = new S3Client({ region: process.env.AWS_EXECUTION_REGION });

export const handler = async (event) => {
    try {
        console.log(`Event: ${JSON.stringify(event)}`);

        const record = event.Records[0];
        const body = JSON.parse(record.body);
        console.log(`Message body: ${JSON.stringify(body)}`);

        const s3Response = await s3Client.send(new GetObjectCommand({
            Bucket: body.bucket,
            Key: body.key
         }));

        const attachment = {
            filename: process.env.ATTACHMENT_FILE_NAME,
            content: s3Response.Body
        };

        var bodyHtml = "<!DOCTYPE html>\n<html lang=\"en\">\n    <head>\n        <meta charset=\"UTF-8\">\n        <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>Atualização de Pedido</title>\n        <style>\n            body {\n                font-family: Arial, sans-serif;\n                line-height: 1.6;\n                margin: 0;\n                padding: 0;\n                background-color: #f4f4f4;\n                color: #333;\n            }\n\n            .container {\n                max-width: 600px;\n                margin: 20px auto;\n                padding: 20px;\n                background-color: #fff;\n                border-radius: 8px;\n                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);\n            }\n\n            h1 {\n                color: #333;\n            }\n\n            p {\n                margin-bottom: 20px;\n            }\n\n            .name {\n                font-weight: bold;\n            }\n\n            .footer {\n                margin-top: 50px;\n                text-align: left;\n            }\n\n            .company-name {\n                color: #4783ee;\n                font-weight: bold;\n            }\n        </style>\n    </head>\n    <body>\n        <div class=\"container\">\n            <h1>Relatório de registro de ponto</h1>\n            <p>Olá, <span class=\"name\">{{employeeid}}</span>.</p>\n            <p>O seu relatório de registro de ponto está anexo a esse e-mail no formato PDF.</p>\n            <p>Fique à vontade para entrar em contato se tiver alguma dúvida.</p>\n            <div class=\"footer\">\n                <p>Atenciosamente,<br><span class=\"company-name\">FIAP SOAT2 Grupo13</span></p>\n            </div>\n        </div>\n    </body>\n</html>";
        bodyHtml = bodyHtml.replace("{{employeeid}}", body.employeeId);

        const rawEmail = await createRawEmail(
            process.env.SES_SOURCE_ADDRESS,
            body.employeeEmail,
            process.env.EMAIL_SUBJECT,
            bodyHtml,
            attachment
        );

        const response= await sesClient.send(new SendRawEmailCommand({
            RawMessage: { Data: Buffer.from(rawEmail) },
            Source: process.env.SES_SOURCE_ADDRESS
        }));

        console.log(`Hackathon time sheet notification service success response: ${JSON.stringify(response)}`);
        return response;
    } catch (error) {
        console.error(`Hackathon time sheet notification service error response: ${error}`);
        throw new Error(error);
    }
};


async function createRawEmail(sender, recipient, subject, bodyHtml, attachment) {
    const boundary = 'NextPart';
    const header = `From: ${sender}\n` +
        `To: ${recipient}\n` +
        `Subject: ${subject}\n` +
        'MIME-Version: 1.0\n' +
        `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`;

    const body =
        `--${boundary}\n` +
        'Content-Type: text/html; charset=us-ascii\n\n' +
        `${bodyHtml}\n\n` +
        `--${boundary}\n` +
        'Content-Type: application/pdf;\n' +
        `Content-Disposition: attachment; filename="${attachment.filename}"\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        `${Buffer.from(await attachment.content.transformToByteArray()).toString('base64')}\n\n` +
        `--${boundary}--`;

    return header + body;
};