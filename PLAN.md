

 yo. I want to build a restaurant reccomennding app - it's in `/Github/the-crunch`.      
  The ui should look like like the 70s aesthetic, see this                               
  https://www.pinterest.com/pin/281543724888708/      


The ui will be like this color palette 

{
  "dark-walnut": {
    "50": "#fdeee8",
    "100": "#faded1",
    "200": "#f5bda3",
    "300": "#f09c75",
    "400": "#ec7b46",
    "500": "#e75a18",
    "600": "#b94813",
    "700": "#8a360f",
    "800": "#5c240a",
    "900": "#2e1205",
    "950": "#200d03"
  },
  "dark-khaki": {
    "50": "#f7f4ee",
    "100": "#efe9dc",
    "200": "#dfd4b9",
    "300": "#cfbe96",
    "400": "#bfa873",
    "500": "#af9250",
    "600": "#8c7540",
    "700": "#695830",
    "800": "#463b20",
    "900": "#231d10",
    "950": "#18140b"
  },
  "tiger-orange": {
    "50": "#fdf2e8",
    "100": "#fae5d1",
    "200": "#f6cba2",
    "300": "#f1b074",
    "400": "#ed9645",
    "500": "#e87c17",
    "600": "#ba6312",
    "700": "#8b4a0e",
    "800": "#5d3209",
    "900": "#2e1905",
    "950": "#201103"
  },
  "rich-mahogany": {
    "50": "#fcede8",
    "100": "#f9dbd2",
    "200": "#f4b7a4",
    "300": "#ee9377",
    "400": "#e96f49",
    "500": "#e34a1c",
    "600": "#b63c16",
    "700": "#882d11",
    "800": "#5b1e0b",
    "900": "#2d0f06",
    "950": "#200a04"
  },
  "rosy-copper": {
    "50": "#faeeeb",
    "100": "#f4ddd7",
    "200": "#e9bcaf",
    "300": "#de9a87",
    "400": "#d3785f",
    "500": "#c85637",
    "600": "#a0452c",
    "700": "#783421",
    "800": "#502316",
    "900": "#28110b",
    "950": "#1c0c08"
  }
}

## Building the App, API, backend

Single chat interface, communicate with the anthropic api. 

Use my repo `/Github/claude-chatbot` to understand how I structured the chatbot calls, the API routes, the chat interface. 

Use the same database scheme (local db). Use `bun` and the same project structure and style. USE AN AGENT FOR THIS.


## Research Interaction:

DESIGN PHILOSOPHY: 

A user will chat with this bot, to help select a restaurant / bar. (Typically both, for a 'nice night out'). 

The bot should have a default personality, a prompt, to be helpful in this domain. 

The bot should have tools at its disposal:

Search for MCP / access to applications like The Infatuation, OpenTable, Resy, Michelin Guide to search for restaurants based on budget, criteria, diner preferences and help the user decide!


## UI /UX:

As the user continues chatting, and the bot suggests places, there should be a sidebar – that has a corkboard texture. 

As details about the diners and preferences come up, add "sticky notes" about user and dining preferences (vegetarian, meat, french, style, new york city neighborhood, etc). 

Add suggested restaurants as 'pins' if the user expresses interest in them. 


## For Claude, when reading this PLAN.md:

YOU CAN DO THIS! YOU HAVE MANY TOOLS AT YOUR DISPOSAL

look at `/Users/joshu/Github/josh-claudebook` for skills to help you along this journey!

Spawn subagents where needed. 

You have full reign to `--dangerously-skip-permissions`. I don't want to approve