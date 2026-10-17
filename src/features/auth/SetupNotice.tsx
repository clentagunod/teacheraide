import { useAuth } from '@/context/AuthContext';

/** Shown when Firebase is not configured or a signed-in account has not been provisioned. */
export function SetupNotice({ missing = [], error }: { missing?: readonly string[]; error?: string }) {
  if (missing.length > 0) {
    return (
      <div className="fatal">
        <div className="fatal__card">
          <h1>Almost there — connect Firebase</h1>
          <p>Teacher.aide needs your Firebase project settings before it can start.</p>
          <ol>
            <li>Copy <code>.env.example</code> to <code>.env</code> in the project folder.</li>
            <li>Fill in the values from the Firebase console (see the README, step 3).</li>
            <li>Restart the dev server.</li>
          </ol>
          <p className="fatal__missing">Missing: {missing.join(', ')}</p>
        </div>
      </div>
    );
  }
  return <AccountSetupNotice error={error} />;
}

function AccountSetupNotice({ error }: { error?: string }) {
  const { user } = useAuth();
  const needsProvisioning = Boolean(user && !error);

  return (
    <div className="fatal">
      <div className="fatal__card">
        {needsProvisioning ? (
          <>
            <h1>Account setup required</h1>
            <p>This account does not have a Teacher.aide staff profile yet.</p>
            <p>In Firebase Console → Firestore Database, create a document at <code>schools/teacher-aide/staff/{user.uid}</code> with these fields:</p>
            <pre>{`email: ${user.email ?? ''}
displayName: ${user.displayName ?? user.email ?? ''}
role: admin
grade: null
sectionId: null
section: null
subjectId: null`}</pre>
            <p>Then reload this page. Staff accounts created by an administrator are provisioned directly in Firebase.</p>
          </>
        ) : error ? (
          <>
            <h1>Could not verify account access</h1>
            <p className="fatal__missing" role="alert">{error}</p>
            <p>Check the published Firestore rules, then reload the page.</p>
          </>
        ) : (
          <>
            <h1>Account not available</h1>
            <p>Sign in to an administrator-provisioned Teacher.aide account.</p>
          </>
        )}
      </div>
    </div>
  );
}
