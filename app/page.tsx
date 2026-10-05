export default function Home() {
  return (
    <div>
      <h1 className="text-xl font-semibold">job-radar</h1>
      <p className="mt-2 text-gray-600">
        Start at <a className="underline" href="/resume">Resume</a> to upload and edit your profile,
        then check <a className="underline" href="/jobs">Jobs</a> for matches.
      </p>
    </div>
  );
}
