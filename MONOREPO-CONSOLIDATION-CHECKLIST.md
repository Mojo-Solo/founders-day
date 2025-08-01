# Monorepo Consolidation Safety Checklist

## ✅ Pre-Consolidation Checklist

### 1. **Backup Status**
- [ ] Run `./create-backup.sh` to create local backup
- [ ] Verify backup created on Desktop
- [ ] Check both uncompressed folder and .tar.gz file exist

### 2. **Current Git Status**
- [x] Frontend changes pushed to: https://github.com/Mojo-Solo/founders-day.git
- [ ] Admin repo status checked
- [ ] No uncommitted work in either repo

### 3. **Current Repository Info**
```
Frontend: https://github.com/Mojo-Solo/founders-day.git
Admin: https://github.com/Mojo-Solo/founders-day-admin.git
```

### 4. **Vercel Projects**
- Frontend Project ID: `prj_el2lG9gsdo6PGbEaZXXMc2GzoNlL`
- Admin Project ID: (check in founders-day-admin/.vercel/project.json)

## 🚀 Consolidation Plan

### Phase 1: Repository Setup
1. Create new repository: `founders-day` (or rename existing)
2. Clone fresh copy to a new location
3. Set up monorepo structure:
   ```
   founders-day/
   ├── apps/
   │   ├── frontend/
   │   └── admin/
   ├── packages/
   │   └── shared-types/
   ├── package.json
   ├── pnpm-workspace.yaml
   └── .gitignore
   ```

### Phase 2: Code Migration
1. Move `founders-day-frontend` → `apps/frontend`
2. Move `founders-day-admin` → `apps/admin`
3. Move `shared-types` → `packages/shared-types`
4. Update all import paths for shared-types
5. Update pnpm-workspace.yaml paths

### Phase 3: Configuration Updates
1. Update root package.json with workspace scripts
2. Configure Vercel for both apps:
   - Frontend: root directory = `apps/frontend`
   - Admin: root directory = `apps/admin`
3. Update CI/CD workflows

### Phase 4: Testing
1. Test local development for both apps
2. Test build process for both apps
3. Test shared-types imports
4. Deploy to Vercel staging

### Phase 5: Cleanup
1. Archive old repositories
2. Update documentation
3. Notify team of new structure

## 🛡️ Rollback Plan

If anything goes wrong:
1. Your backup is at: `~/Desktop/founders-day-backup-[timestamp]`
2. Original repos still exist on GitHub
3. Can restore from backup using:
   ```bash
   tar -xzf ~/Desktop/founders-day-backup-[timestamp].tar.gz
   ```

## ⚠️ Important Notes

- Both GitHub repos currently exist separately
- Vercel is already configured for deployments
- All recent changes have been pushed to GitHub
- Square SDK v43 migration is complete and working

## Ready to Proceed?

Once you've:
1. ✅ Run the backup script
2. ✅ Verified the backup exists
3. ✅ Reviewed this checklist

You're ready to start the consolidation!