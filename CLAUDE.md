# Upskilling Skills Proof-of-Concept

Claude has a powerful feature called Skills, which are described in detail here:
https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
https://platform.claude.com/docs/en/build-with-claude/skills-guide

However, they aren't particularly discoverable in the product right now. This POC demonstrates an extension of the Claude.ai chat product functionality to make Skills discoverable in the user's own context of use.

The project runs on Cloudflare pages, and permits use behind a password authentication (.env's WEBSITE_DEMO_PASSWORD). The backend is made up of stateless Hono cloud functions for inference, and end-user state is stored in localStorage on a React SPA.

## Demo

The demo is as follows:
- User chats with a web application similar to Claude.ai. However, the chat history is prepopulated with a togglable "Profile" that embodies a professional persona like Lawyer, "Analyst", "Social Media Manager", demonstrating different usage scenarios. 
- Some of the conversations in each profile demonstrate a repeated workflow that would benefit from capturing the workflow's knowledge in Skills.
- The user can create a new conversation with either a freeform prompt, or selecting from a list of preset prompts.
- If the user specifies a task similar to a previously observed workflow (particularly those demonstrated by the presets), the system will respond normally and additionally prompt the user to create a Skill. The prompt invokes the provided skill-creator Skill (lib/skills/skill-creator). The chat model is instructed to cue the user by briefly explaining how a Skill would capture the particularities of their workflow, and how it would simplify future invocation.
  - The response itself includes a banner with a call-to-action button for creating the Skill, which invokes create-skill.

## Components

It is made up of the following components:

- **Chat skeleton**: a medium fidelity emulation of Claude.ai's chat product, with some modifications. It namely contains:
  - "Profiles" - for demoing, multiple different users and a clearly-visible dropdown for flipping between them. E.g., "Lawyer", "Analyst", "Social Media Manager". These are served statically in the bundle, dynamically loaded. More below.
  - A means of chatting with Claude
    - Document/image attachment support
    - Skills support
    - Charting support via Recharts (inline)
    - Inline banner support (for cueing the user to create a skill)
    - Above the message composer, providing preset conversation starters that are hardcoded for each profile, so users of the demo can see the proposed functionality easily.
  - A means of browsing previous conversations (sidebar etc)
  - A "Customize" view like the one live on Claude.ai, where we can see live skills.
  - Chatting with Claude via Opus 4.8 via ANTHROPIC_API_KEY in .env.
- **Synthetic data pipeline**: A way to populate Profiles offline, interspersing domain-specific workflow conversations and personal/Q&A conversations. We'll store these in git as static files that get compiled into the frontend bundle. We'll specify these together.
- **Workflow extraction engine**: A means of extracting features from workflow-like conversations to index for online querying.
  - Workflow features for the demo Profile conversations will be pre-extracted offline via the Synthetic Data Pipeline, while every new conversation created by the user will be processed through online inference.
- **Skill cueing decider**: In the chat response pipeline, detecting if a Skill is appropriate. More below.
- **Offline evaluation script**: Evaluating the workflow inference engine based on the data we generate (precision/recall for triggering the creation flow and the skills themselves).

## Personae

The personae will require some iteration, but broad-strokes:

### Data analyst

The data analyst is often preparing charts for company decks. They need a consistent color scheme, no gridlines/legend, and bar charts need to be sorted, among other preferences. Other specs may come up. Synthesize some CSVs to attach.

### Lawyer

The lawyer is frequently reviewing NDAs. They need NDAs to be mutual, governed under CA or DE, outputting a clause by clause table, rating risk, and no non-solicit riders, as well as flags for off-market clauses.

### Social Media Manager

The social media manager is promoting artworks at their gallery on Instagram. They need appropriate hashtags, a highbrow audience, no "LLM slop" em dashes or grandiosity, and will provide upfront information about the work.

Each persona has a mix of at least 3 clusters of potential distinct workflows, with various spurious personal/Q&A conversations interspersed, to reflect authentic workflows.

## Skill/Workflow inference

### Extraction

We extract plaintext workflow descriptions after each conversation "ends". For user-created conversations, this is overwritten on every turn for ease of demoing, and inferred offline for synthetic Profile conversations.

The data structure is a list of sets: the list is chronological, the sets contain each individual conversation's summary, highlighting workflow-able aspectswith direct quotations. Each conversation is a member of a set, potentially clustered with other related workflows, ordered by recently updated.

An example set would be:
```
{
	"Created a bar chart for earnings, needed 'no gridlines', 'viridis color scheme'.",
        "Made bar charts for growth across products, asked to 'make colors viridis', 'without gridlines'"
}
```

Once a set like this forms, a Skill is overdue, and be cued to the user.

Note that if the user explicitly rejects/accepts creating a skill for that set, it must be noted in the skill summary.


### Cueing

We want to cue for a skill if:

* The user has invoked a similar workflow at least once before
* The knowledge can be readily captured in a Skill in a way that's retrospectively obvious to the user
* The user didn't already reject/ignore/accept a cue to create that skill.

We analyze the user message before the response model receives it to see if it's cue-able. If it is cue-able, we add instructions to the response model's context to cue the user at the end of the message, and invoke an inline banner UI to create the skill.

The cue should be self-justifying and brief. Something like, "I noticed you always want orange bar charts without gridlines. If you'd like, I can remember how you create bar charts in the future by creating a Skill. That way, you just have to ask me for a bar chart, and I'll remember your specific preferences. Would you like to create a Skill?"

If the user hits "create skill" or asks to create one, we invoke the flow in the skill creator skill, then write the skill data and ID to localStorage. The skill gets persisted, but the ID is only enumerable for the individual's browser. If we reach any sort of limit in the backend, remove the oldest skills (that don't include the original skill creator skill).
