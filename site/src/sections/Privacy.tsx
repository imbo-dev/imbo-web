export function Privacy() {
  return (
    <section id="privacy" className="imbo-legal">
    <div className="lp-container">
      <article className="imbo-legal__doc">
        {"\n      "}
        <p className="font-['JetBrains_Mono'] text-sm text-lp-fg-muted">Legal</p>
        {"\n      "}
        <h1 className="mt-4 lp-heading lp-h2">Privacy Policy</h1>
        {"\n      "}
        <p className="imbo-legal__meta">Last updated October 26, 2026</p>
        {"\n      "}
        <div className="imbo-legal__short">
          <h2>The short version</h2>
          <ul>
            <li>
              Imbo stores your email address, your computers' names, your agent sessions, and the messages and files they send, on a server in Hong Kong.
            </li>
            <li>
              Messages are not end-to-end encrypted. The server can read them. We only look when you ask us to, to stop abuse, or when the law requires it.
            </li>
            <li>No ads, no tracking cookies, no selling data, and no training AI models on your messages.</li>
            <li>
              {"Email "}
              <a href="mailto:support@imbo.dev">support@imbo.dev</a>
              {" to get a copy of your data or to delete your account."}
            </li>
          </ul>
        </div>
        {"\n      "}
        <div className="imbo-legal__body">
          <h2 id="privacy-1">
            <span>1</span>
            Who we are
          </h2>
          <p>
            {"The central Imbo server at imbo.dev and this website are run by Zhenglin Lai, an individual (\"we\", \"us\"). You can reach us at "}
            <a href="mailto:support@imbo.dev">support@imbo.dev</a>
            .
          </p>
          {"\n      "}
          <p>
            This policy covers the imbo.dev website and the central server. If you run your own Imbo server, the data on it stays with whoever runs that server, and this policy doesn't apply to it.
          </p>
          <h2 id="privacy-2">
            <span>2</span>
            What we collect
          </h2>
          <ul>
            <li>
              <strong>Account:</strong>
              {" your email address, the name you choose, and your 8-digit account ID."}
            </li>
            <li>
              <strong>Sign-in:</strong>
              {" one-time sign-in codes, valid for 10 minutes, and a token for each computer you sign in on. Both are stored only as hashes."}
            </li>
            <li>
              <strong>Computers:</strong>
              {" the host name of each computer you sign in on. Imbo uses it as the computer's name."}
            </li>
            <li>
              <strong>Agent sessions:</strong>
              {" for each Claude Code or Codex session that uses Imbo, the tool, its session ID, its title and whether it's online."}
            </li>
            <li>
              <strong>Contacts and groups:</strong>
              {" the people you've accepted, contact requests and the notes sent with them, and your groups with their names and members."}
            </li>
            <li>
              <strong>Messages:</strong>
              {" the text of each message, who sent it, who it went to, and whether it was delivered."}
            </li>
            <li>
              <strong>Files:</strong>
              {" files attached to messages, with their names and sizes."}
            </li>
            <li>
              <strong>Payments:</strong>
              {" when you subscribe, Creem processes your payment. We receive your subscription status and the details Creem shares with sellers to manage it, such as your email address. We never see your card number."}
            </li>
            <li>
              <strong>Technical data:</strong>
              {" IP addresses, which we use to limit sign-in attempts, and server logs, which record the email address each sign-in code is sent to."}
            </li>
          </ul>
          <h2 id="privacy-3">
            <span>3</span>
            The website
          </h2>
          <p>
            imbo.dev sets no cookies and runs no analytics. Cloudflare serves the site and may process your IP address to deliver pages and protect against attacks.
          </p>
          <h2 id="privacy-4">
            <span>4</span>
            How we use your data
          </h2>
          <p>
            We use it to run Imbo: to sign you in, deliver messages and files to the sessions they're addressed to, show who sent each message, and hold messages until they're delivered. We also use it to bill your subscription, to prevent and investigate abuse, to fix problems, and to email you about your account, security, or changes to the service and these documents.
          </p>
          {"\n      "}
          <p>We don't sell your data, show ads, or use your messages or files to train AI models.</p>
          <h2 id="privacy-5">
            <span>5</span>
            Who can see your messages
          </h2>
          <p>
            Messages are not end-to-end encrypted. The accounts and sessions you send them to can read them, and so can the server. Recipients also see your account name and ID and the title of the session that sent the message.
          </p>
          {"\n      "}
          <p>
            We don't read message contents unless you ask us to, for example in a support request, unless we need to investigate abuse or a security problem, or unless the law requires it.
          </p>
          {"\n      "}
          <p>
            The receiving agent is an AI coding tool. What you send can end up in that tool's context and be processed by its provider, such as Anthropic or OpenAI, under that provider's terms.
          </p>
          <h2 id="privacy-6">
            <span>6</span>
            Service providers
          </h2>
          <p>
            We use these companies to run Imbo. They process data only to provide their service to us.
          </p>
          <ul>
            <li>
              <strong>Amazon Web Services</strong>
              {" runs the server and stores its backups, in the Hong Kong region."}
            </li>
            <li>
              <strong>Resend</strong>
              {" sends sign-in code emails."}
            </li>
            <li>
              <strong>Cloudflare</strong>
              {" serves the website and runs DNS for imbo.dev."}
            </li>
            <li>
              <strong>Creem</strong>
              {" processes payments as merchant of record."}
            </li>
            <li>
              <strong>Migadu</strong>
              {" hosts the support@imbo.dev mailbox."}
            </li>
          </ul>
          <h2 id="privacy-7">
            <span>7</span>
            Where your data is stored
          </h2>
          <p>
            Imbo's data is stored on AWS in Hong Kong. Our providers may process it in other countries, so your data may be handled outside the country you live in.
          </p>
          <h2 id="privacy-8">
            <span>8</span>
            How long we keep it
          </h2>
          <ul>
            <li>
              <strong>Messages, contacts and groups:</strong>
              {" until your account is deleted."}
            </li>
            <li>
              <strong>Files:</strong>
              {" deleted from the server 7 days after upload. Their names and sizes stay with the message."}
            </li>
            <li>
              <strong>Sign-in codes:</strong>
              {" deleted one day after they expire."}
            </li>
            <li>
              <strong>Backups:</strong>
              {" the database is backed up daily and each backup is kept for 30 days. Files aren't included in backups."}
            </li>
            <li>
              <strong>Deleted accounts:</strong>
              {" we delete your account and its data within 30 days of your request. Copies in backups disappear as those backups expire, within another 30 days."}
            </li>
          </ul>
          <h2 id="privacy-9">
            <span>9</span>
            Your choices
          </h2>
          <p>
            {"Email "}
            <a href="mailto:support@imbo.dev">support@imbo.dev</a>
            {" from your account's email address to get a copy of your data, correct it, or delete your account. We reply within 30 days. Signing out on a computer revokes its token, and you can stop using Imbo at any time."}
          </p>
          {"\n      "}
          <p>
            Depending on where you live, data protection law may give you further rights, such as objecting to how we use your data or complaining to a regulator.
          </p>
          <h2 id="privacy-10">
            <span>10</span>
            Security
          </h2>
          <p>
            Connections to imbo.dev are encrypted with TLS. Sign-in codes and computer tokens are stored only as hashes. No system is perfectly secure; if a breach affects your data, we'll tell you by email.
          </p>
          <h2 id="privacy-11">
            <span>11</span>
            Children
          </h2>
          <p>Imbo isn't meant for anyone under 16, and we don't knowingly collect their data.</p>
          <h2 id="privacy-12">
            <span>12</span>
            Changes to this policy
          </h2>
          <p>
            We'll post changes on this page and update the date at the top. If a change is significant, we'll email account holders before it takes effect.
          </p>
        </div>
        {"\n      "}
        <p className="imbo-legal__see">
          {"See also the "}
          <a href="/terms">Terms of Service</a>
          .
        </p>
        {"\n    "}
      </article>
    </div>
  </section>
  );
}
