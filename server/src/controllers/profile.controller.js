const profileService = require('../services/profile.service');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

module.exports = {
  getMe: wrap(async (req, res) => {
    const profile = await profileService.getOrCreate(req.user.id);
    res.json({ profile });
  }),

  updateMe: wrap(async (req, res) => {
    const profile = await profileService.updateOwn(req.user.id, req.body);
    res.json({ profile });
  }),

  uploadPicture: wrap(async (req, res) => {
    const profile = await profileService.setPicture(req.user.id, req.file);
    res.json({ profile });
  }),

  uploadDocument: wrap(async (req, res) => {
    const profile = await profileService.addDocument(req.user.id, req.file, req.body.name);
    res.json({ profile });
  }),

  list: wrap(async (req, res) => {
    const result = await profileService.adminList(req.query);
    res.json(result);
  }),

  getOne: wrap(async (req, res) => {
    const profile = await profileService.getForActor(req.user, req.params.userId);
    res.json({ profile });
  }),

  team: wrap(async (req, res) => {
    const result = await profileService.teamList(req.user, req.query);
    res.json(result);
  }),

  updateOne: wrap(async (req, res) => {
    const profile = await profileService.adminUpdate(req.params.userId, req.body);
    res.json({ profile });
  }),

  deleteOne: wrap(async (req, res) => {
    const result = await profileService.adminDelete(req.user.id, req.params.userId);
    res.json(result);
  }),
};
