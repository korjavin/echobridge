const axios = require('axios');
const { handler } = require('../src/alexa-skill');

jest.mock('axios');

describe('Alexa Skill WhoIsOnDutyHandler', () => {
    let mockHandlerInput;

    beforeEach(() => {
        process.env.DUTY_URL = 'http://test-duty-url.com';

        mockHandlerInput = {
            requestEnvelope: {
                request: {
                    type: 'IntentRequest',
                    intent: { name: 'WhoIsOnDutyIntent' }
                }
            },
            responseBuilder: {
                speak: jest.fn().mockReturnThis(),
                getResponse: jest.fn().mockReturnValue({ type: 'Response' })
            }
        };

        // Reset mocks before each test
        axios.get.mockReset();
    });

    afterEach(() => {
        delete process.env.DUTY_URL;
    });

    async function invokeHandler() {
        return await handler.invoke(mockHandlerInput);
    }

    it('should handle name-only response (plain text)', async () => {
        axios.get.mockResolvedValue({ data: 'Alice' });

        const response = await invokeHandler();

        expect(response.response.outputSpeech.ssml).toBe('<speak>Today on duty: Alice.</speak>');
    });

    it('should handle name-only response (JSON)', async () => {
        axios.get.mockResolvedValue({ data: { name: 'Bob' } });

        const response = await invokeHandler();

        expect(response.response.outputSpeech.ssml).toBe('<speak>Today on duty: Bob.</speak>');
    });

    it('should handle response with name and chores', async () => {
        axios.get.mockResolvedValue({
            data: {
                name: 'Charlie',
                chores: [
                    { description: 'Take out trash', assignee: 'Charlie', deadline_at: '5pm' },
                    { description: 'Feed the dog' } // missing assignee and deadline
                ]
            }
        });

        const response = await invokeHandler();

        expect(response.response.outputSpeech.ssml).toBe(
            '<speak>Today on duty: Charlie. Take out trash, assigned to Charlie, due 5pm. Feed the dog.</speak>'
        );
    });

    it('should handle response with empty chores array', async () => {
        axios.get.mockResolvedValue({
            data: {
                name: 'Dave',
                chores: []
            }
        });

        const response = await invokeHandler();

        expect(response.response.outputSpeech.ssml).toBe('<speak>Today on duty: Dave.</speak>');
    });

    it('should handle response with missing assignee and deadline fields in chores', async () => {
        axios.get.mockResolvedValue({
            data: {
                name: 'Eve',
                chores: [
                    { description: 'Clean the kitchen', deadline_at: 'tomorrow' },
                    { description: 'Vacuum', assignee: 'Frank' }
                ]
            }
        });

        const response = await invokeHandler();

        expect(response.response.outputSpeech.ssml).toBe(
            '<speak>Today on duty: Eve. Clean the kitchen, due tomorrow. Vacuum, assigned to Frank.</speak>'
        );
    });
});
