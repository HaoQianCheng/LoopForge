import {test,expect} from '@playwright/test';
import {signInUnconfigured} from './helpers.mjs';

test.use({trace:'off',screenshot:'off'});

test('GitLab credentials are independent, redacted and verified as identity only',async({page})=>{
  await signInUnconfigured(page);
  await expect(page.locator('#aiAssistant .ai-compose-input')).toBeEnabled();
  const current=await page.request.get('/api/auth/current').then(r=>r.json());
  const user=current.user;
  const credentials=`/api/users/${user.id}/credentials`;
  const inert='e2e-inert-gitlab-token-not-for-network-use';
  try{
    await page.goto('/#/settings');
    await page.locator('[name="gitLabBaseUrl"]').fill('https://gitlab.example.com');
    await page.locator('[name="gitLabToken"]').fill(inert);
    const pending=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname===credentials);
    await page.locator('#userCredentialForm button[type="submit"]').click();
    const saved=await pending;
    expect(saved.ok()).toBe(true);
    const publicUser=await saved.json();
    expect(publicUser.gitLabTokenConfigured).toBe(true);
    expect(publicUser.gitLabToken).toBeUndefined();
    expect(!!publicUser.gitTokenConfigured).toBe(!!user.gitTokenConfigured);
    expect(JSON.stringify(publicUser)).not.toContain(inert);
    await page.reload();
    await expect(page.locator('[name="gitLabToken"]')).toHaveValue('');
    await expect(page.locator('[name="gitLabBaseUrl"]')).toHaveValue('https://gitlab.example.com');
    await page.route('**/api/users/*/gitlab-token/verify',route=>route.fulfill({json:{valid:true,login:'gitlab-test-user'}}));
    await page.locator('#verifyGitLabToken').click();
    await expect(page.locator('#gitLabTokenVerifyStatus')).toContainText('gitlab-test-user');
    await expect(page.locator('#gitLabTokenVerifyStatus')).toContainText('仓库权限尚未验证');
    await page.locator('#langToggle').click();
    await expect(page.locator('#userCredentialForm')).toContainText('Self-managed GitLab');
  }finally{
    expect((await page.request.put(credentials,{data:{gitLabTokenClear:true,gitLabBaseUrl:''}})).ok()).toBe(true);
  }
});
