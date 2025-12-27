# relaiy.io

Describe what you want your emails to do, and Relaiy turns it into safe, reviewable workflows that run automatically. You can automate your Gmail tasks effortlessly by describing what you want in plain English — no coding or complex rules required.

---

## Motivation & Overview

Once upon a time, I opened Zapier and was greeted with the most confusing and hard-to-set-up workflow configurator I had ever seen. As a Computer Science student even with my level of confusion, I can only imagine how much more confusing it would be for non-technical people.

Relaiy is designed for users who want to automate Gmail workflows without learning code or complex automation tools... Frictionless. Users create “workers” — automated email tasks — simply by describing what they want in plain English. The system generates a structured, deterministic configuration for review before execution, ensuring predictability and safety.

Use cases include:

* Job application follow-ups
* Client onboarding sequences
* Sales or lead nurturing
* Newsletter management
* *anything repetitive...*

---

## Features

* **Natural Language Workers:** Describe email automation in plain English.
* **Safe Config Generation:** LLM converts descriptions into a structured config for review.
* **Human-Readable Summaries:** See exactly what each worker will do before activation.
* **Playground:** Simulate actions on historical emails without sending anything.
* **Automated Scheduling:** Workers run in the background according to your rules.
* **Action Logging & Versioning:** Every execution is logged; configs can be paused, edited, or versioned.

---

## How It Works

1. Connect your Gmail account via OAuth.
2. Create a worker and describe your desired workflow in natural language.
3. The system generates a structured configuration using an LLM (low temperature, schema-validated).
4. Review the human-readable summary and answer any clarifying questions.
5. Run a dry test to see which emails would be affected.
6. Activate the worker — the scheduler executes actions deterministically, such as sending emails, replying, or labeling conversations.

**Key Principle:** The LLM is only used for configuration generation. Execution is fully deterministic and safe.

---

## Tech Stack

* **Frontend:** Next.js (React)
* **Backend:** Node.js / Express
* **Database:** PostgreSQL
* **Scheduler:** Cron jobs (polling-based, can be upgraded to push notifications)
* **Email API:** Gmail OAuth / Gmail API
* **AI:** LLM API for config primitive generation

---

## Getting Started

### Prerequisites

* Node.js >= 18
* PostgreSQL
* Gmail account with OAuth credentials
* OpenAI API access
