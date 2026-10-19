//! The loopback API token file: only this user can read it, and no old contents survive a rewrite.

use anyhow::{Context, Result};
use std::io::Write as _;
use std::path::Path;

/// Writes `token` to `path`, replacing any earlier contents, and restricts the file to this user (0600 on Unix).
pub fn write(path: &Path, token: &str) -> Result<()> {
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt as _;
        opts.mode(0o600);
    }
    // No truncate at open: the old contents stay until the permissions are restricted.
    let mut f = opts.open(path).with_context(|| format!("creating {}", path.display()))?;
    #[cfg(unix)]
    {
        // `mode` only applies to new files: an existing token keeps its old permissions.
        use std::os::unix::fs::PermissionsExt as _;
        f.set_permissions(std::fs::Permissions::from_mode(0o600))
            .with_context(|| format!("restricting {}", path.display()))?;
    }
    f.set_len(0).with_context(|| format!("truncating {}", path.display()))?;
    f.write_all(token.as_bytes()).with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;
    use std::os::unix::fs::PermissionsExt as _;
    use std::path::PathBuf;

    fn temp_path() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("codync-token-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("token")
    }

    fn mode(path: &Path) -> u32 {
        std::fs::metadata(path).unwrap().permissions().mode() & 0o777
    }

    #[test]
    fn new_file_is_created_private_with_the_token() {
        let path = temp_path();
        write(&path, "abc").unwrap();
        assert_eq!(mode(&path), 0o600);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "abc");
    }

    #[test]
    fn existing_world_readable_file_is_restricted_and_overwritten() {
        let path = temp_path();
        std::fs::write(&path, "old").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        write(&path, "new-token").unwrap();
        assert_eq!(mode(&path), 0o600);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "new-token");
    }

    #[test]
    fn shorter_token_leaves_no_tail_of_the_old_one() {
        let path = temp_path();
        write(&path, &"x".repeat(200)).unwrap();
        write(&path, "short").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "short");
    }
}
