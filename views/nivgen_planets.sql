CREATE VIEW data_view AS
SELECT data.*,
  ((data.orig_surf IS NOT NULL AND ((data.rust_surf IS NOT NULL AND data.rust_surf != data.orig_surf) OR (data.lr_surf IS NOT NULL AND data.lr_surf != data.orig_surf))) +
  (data.orig_atmo IS NOT NULL AND ((data.rust_atmo IS NOT NULL AND data.rust_atmo != data.orig_atmo) OR (data.lr_atmo IS NOT NULL AND data.lr_atmo != data.orig_atmo))) +
  (data.orig_pal IS NOT NULL AND ((data.rust_pal IS NOT NULL AND data.rust_pal != data.orig_pal) OR (data.lr_pal IS NOT NULL AND data.lr_pal != data.orig_pal))) +
  (data.orig_sect_def_hm IS NOT NULL AND ((data.rust_sect_def_hm IS NOT NULL AND data.rust_sect_def_hm != data.orig_sect_def_hm) OR (data.lr_sect_def_hm IS NOT NULL AND data.lr_sect_def_hm != data.orig_sect_def_hm))) +
  (data.orig_sect_def_oc IS NOT NULL AND ((data.rust_sect_def_oc IS NOT NULL AND data.rust_sect_def_oc != data.orig_sect_def_oc) OR (data.lr_sect_def_oc IS NOT NULL AND data.lr_sect_def_oc != data.orig_sect_def_oc))) +
  (data.orig_sect_rand_hm IS NOT NULL AND ((data.rust_sect_rand_hm IS NOT NULL AND data.rust_sect_rand_hm != data.orig_sect_rand_hm) OR (data.lr_sect_rand_hm IS NOT NULL AND data.lr_sect_rand_hm != data.orig_sect_rand_hm))) +
  (data.orig_sect_rand_oc IS NOT NULL AND ((data.rust_sect_rand_oc IS NOT NULL AND data.rust_sect_rand_oc != data.orig_sect_rand_oc) OR (data.lr_sect_rand_oc IS NOT NULL AND data.lr_sect_rand_oc != data.orig_sect_rand_oc))) +
  (data.orig_sect_def_stex IS NOT NULL AND ((data.rust_sect_def_stex IS NOT NULL AND data.rust_sect_def_stex != data.orig_sect_def_stex) OR (data.lr_sect_def_stex IS NOT NULL AND data.lr_sect_def_stex != data.orig_sect_def_stex))) +
  (data.orig_sect_def_sky IS NOT NULL AND ((data.rust_sect_def_sky IS NOT NULL AND data.rust_sect_def_sky != data.orig_sect_def_sky) OR (data.lr_sect_def_sky IS NOT NULL AND data.lr_sect_def_sky != data.orig_sect_def_sky))) +
  (data.orig_sect_rand_stex IS NOT NULL AND ((data.rust_sect_rand_stex IS NOT NULL AND data.rust_sect_rand_stex != data.orig_sect_rand_stex) OR (data.lr_sect_rand_stex IS NOT NULL AND data.lr_sect_rand_stex != data.orig_sect_rand_stex))) +
  (data.orig_sect_rand_sky IS NOT NULL AND ((data.rust_sect_rand_sky IS NOT NULL AND data.rust_sect_rand_sky != data.orig_sect_rand_sky) OR (data.lr_sect_rand_sky IS NOT NULL AND data.lr_sect_rand_sky != data.orig_sect_rand_sky)))) AS errors,
  CASE WHEN (data.rust_surf IS NOT NULL OR data.rust_atmo IS NOT NULL OR data.rust_pal IS NOT NULL OR data.rust_sect_def_hm IS NOT NULL OR data.rust_sect_def_oc IS NOT NULL OR data.rust_sect_rand_hm IS NOT NULL OR data.rust_sect_rand_oc IS NOT NULL OR data.rust_sect_def_stex IS NOT NULL OR data.rust_sect_def_sky IS NOT NULL OR data.rust_sect_rand_stex IS NOT NULL OR data.rust_sect_rand_sky IS NOT NULL) THEN   ((data.rust_surf IS NOT NULL AND data.orig_surf IS NOT NULL AND data.rust_surf != data.orig_surf) +
  (data.rust_atmo IS NOT NULL AND data.orig_atmo IS NOT NULL AND data.rust_atmo != data.orig_atmo) +
  (data.rust_pal IS NOT NULL AND data.orig_pal IS NOT NULL AND data.rust_pal != data.orig_pal) +
  (data.rust_sect_def_hm IS NOT NULL AND data.orig_sect_def_hm IS NOT NULL AND data.rust_sect_def_hm != data.orig_sect_def_hm) +
  (data.rust_sect_def_oc IS NOT NULL AND data.orig_sect_def_oc IS NOT NULL AND data.rust_sect_def_oc != data.orig_sect_def_oc) +
  (data.rust_sect_rand_hm IS NOT NULL AND data.orig_sect_rand_hm IS NOT NULL AND data.rust_sect_rand_hm != data.orig_sect_rand_hm) +
  (data.rust_sect_rand_oc IS NOT NULL AND data.orig_sect_rand_oc IS NOT NULL AND data.rust_sect_rand_oc != data.orig_sect_rand_oc) +
  (data.rust_sect_def_stex IS NOT NULL AND data.orig_sect_def_stex IS NOT NULL AND data.rust_sect_def_stex != data.orig_sect_def_stex) +
  (data.rust_sect_def_sky IS NOT NULL AND data.orig_sect_def_sky IS NOT NULL AND data.rust_sect_def_sky != data.orig_sect_def_sky) +
  (data.rust_sect_rand_stex IS NOT NULL AND data.orig_sect_rand_stex IS NOT NULL AND data.rust_sect_rand_stex != data.orig_sect_rand_stex) +
  (data.rust_sect_rand_sky IS NOT NULL AND data.orig_sect_rand_sky IS NOT NULL AND data.rust_sect_rand_sky != data.orig_sect_rand_sky)) ELSE NULL END AS rust_errors,
  CASE WHEN (data.lr_surf IS NOT NULL OR data.lr_atmo IS NOT NULL OR data.lr_pal IS NOT NULL OR data.lr_sect_def_hm IS NOT NULL OR data.lr_sect_def_oc IS NOT NULL OR data.lr_sect_rand_hm IS NOT NULL OR data.lr_sect_rand_oc IS NOT NULL OR data.lr_sect_def_stex IS NOT NULL OR data.lr_sect_def_sky IS NOT NULL OR data.lr_sect_rand_stex IS NOT NULL OR data.lr_sect_rand_sky IS NOT NULL) THEN   ((data.lr_surf IS NOT NULL AND data.orig_surf IS NOT NULL AND data.lr_surf != data.orig_surf) +
  (data.lr_atmo IS NOT NULL AND data.orig_atmo IS NOT NULL AND data.lr_atmo != data.orig_atmo) +
  (data.lr_pal IS NOT NULL AND data.orig_pal IS NOT NULL AND data.lr_pal != data.orig_pal) +
  (data.lr_sect_def_hm IS NOT NULL AND data.orig_sect_def_hm IS NOT NULL AND data.lr_sect_def_hm != data.orig_sect_def_hm) +
  (data.lr_sect_def_oc IS NOT NULL AND data.orig_sect_def_oc IS NOT NULL AND data.lr_sect_def_oc != data.orig_sect_def_oc) +
  (data.lr_sect_rand_hm IS NOT NULL AND data.orig_sect_rand_hm IS NOT NULL AND data.lr_sect_rand_hm != data.orig_sect_rand_hm) +
  (data.lr_sect_rand_oc IS NOT NULL AND data.orig_sect_rand_oc IS NOT NULL AND data.lr_sect_rand_oc != data.orig_sect_rand_oc) +
  (data.lr_sect_def_stex IS NOT NULL AND data.orig_sect_def_stex IS NOT NULL AND data.lr_sect_def_stex != data.orig_sect_def_stex) +
  (data.lr_sect_def_sky IS NOT NULL AND data.orig_sect_def_sky IS NOT NULL AND data.lr_sect_def_sky != data.orig_sect_def_sky) +
  (data.lr_sect_rand_stex IS NOT NULL AND data.orig_sect_rand_stex IS NOT NULL AND data.lr_sect_rand_stex != data.orig_sect_rand_stex) +
  (data.lr_sect_rand_sky IS NOT NULL AND data.orig_sect_rand_sky IS NOT NULL AND data.lr_sect_rand_sky != data.orig_sect_rand_sky)) ELSE NULL END AS lr_errors
FROM data
