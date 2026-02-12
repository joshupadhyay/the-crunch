
# Learning from Chatbot

## Server-Sent Events

A classic HTTP request comprises of a single action (`GET`, `POST`, `DELETE`) are specific examples. The client asks for a specific piece of information from the server, which then processes the request and sends the response. At this point, the client is waiting (or `await`ing for you JS fiends :) ) for the response. This period of latency is one that we'd want to minimize as much as possible, especially for a tool like a chat app. Users expect some progress *immediately*, and we'd like to convey that the LLM is actually working on the request!

A Server-Sent Event (SSE) sends the response as it is constructed, in pieces. It's a constant stream of information back to the client, meaning the user can see the answer construct itself in real-time, removing the latency issue as much as possible. ChatGPT and Claude use this paradigm; you like seeing the answer come in as it happens. I understand this like a channel of information, or a three-course meal – parts are served when they're ready!

> Unlike a fetch request, I don't think we'd know how many requests we'd need. This is more similar to the websockets paradigm we used in Tic Tac Toe – a long lived connection, but even that published atomic events as they occurred – this is sending everything, immediately.

## Tool use, Yield

### Tools

Claude is incredibly intelligent, and can reach for functions to expand its horizons. In Claude Code, this is the `SKILLS.md` we've created for certain situations. A similar paradigm exists in the API as `tools`. My restaurant recommendation bot, to give great suggestions, needs
            - accurate information on a restaurant's location (neighborhood)
            - be able to find reviews, curated lists, ambiance information
            - confirm the place is still open (a tall order in NYC especially!)

I chose Exa AI, which claims to have blazing-fast web search abilities and a generous free tier. I've defined the tool in `tools.ts`. It's a simple wrapper around the Exa AI SDK, with the description as the reason for Claude to call the tool:

Claude uses the description to call the tool as necessary. Tools can also specify an input schema, where I propose a structured schema and a free-form version as well.

- structured: User is requesting specific information (location, restaurant details, information about a neighborhood)
- unstructured: Claude feels its information is out of date, needs to check the internet

```[json]
  {
    name: "web_search",
    description:
      "Search the web for real-time restaurant details, reviews, hours, and neighborhood info. Use when the user wants to verify specifics about a restaurant or needs current information not in the local database. Use also for guides / reviews that recommend this place to give the user character. Requires EXA_API_KEY.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurant_name: {
          type: "string",
          description:
            "Name of a specific restaurant to look up (e.g., 'L\\'Artusi', 'Dhamaka')",
        },
        location: {
          type: "string",
          description:
            "Neighborhood or area to narrow the search (e.g., 'West Village', 'Lower East Side', 'NYC')",
        },
            ..........
```

There's also an OpenTable integration or sorts, which I plan for direct bookings. I'd also like to explore Browserbase's Stagehand tool to bypass these API calls and have Claude check information and see the web directly!