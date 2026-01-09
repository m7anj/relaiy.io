import Configuration from "./configuration";

enum STATUS {                    
    // A worker has a status which dictates how it will behave, if behave at all.
    SCHEDULED = "SCHEDULED",     // this means that the worker hasn't done THE THING yet, however it is scheduled to do it
    SUCCESS = "SUCCESS",         // this means that the worker has done the thing and it was successful
    ERROR = "ERROR",             // this means that the worker has done the thing and it was unsuccessful
    PAUSED = "PAUSED",           // this means that the worker has been paused either by the user or by the system
}

enum WORKER_TYPE {              
    // Workers can have different styles of behavior, this is how you can categorise them
    OUTREACH = "OUTREACH",      // sends an email to a list of recipients you feed it
    NURTURE = "NURTURE",        // sends conversational-style emails, mainly to facilitate a relationship or a connection, nothing else
    RESPONDER = "RESPONDER",    // responds to emails from the recipients you feed it
    DIGEST = "DIGEST",          // digests emails and summarize them into a single email, either send it back to yourself for summary OR another recipient
}

interface Worker extends Configuration {
    // this is the interface that the worker will use to interact with the system
    id: string,             
    name: string,
    description: string,        // strictly just for user's reference, doesn't affect implementation or behaviour

    status: STATUS,             
    information: string[],          // similar to how claude has Project Context / Information, you can give info to your worker to make it do a better job
    type: WORKER_TYPE,

    recipients: string[],        // list of email addresses that the worker will send to
}

export { STATUS, WORKER_TYPE};
export default Worker;