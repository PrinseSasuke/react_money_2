"""Summarise independently grouped validation for MLP on both datasets."""
import json
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


def main():
    lines=['# MLP: выбор числа итераций по независимым прогонам','',
      'Для каждой конфигурации на train отдельно обучены модели с лимитом 50, 100 и 150 итераций. '
      'Выбран максимальный Macro-F1 на validation, при равенстве — меньший лимит. '
      'Преобразования обучаются только на train; выбранная модель оценивается на отложенных test-прогонах. '
      'Списки прогонов, оценки всех кандидатов, выбранные лимиты, время и пооконные предсказания сохранены.','',
      'Значения ниже — среднее ± стандартное отклонение по пяти групповым разделениям после усреднения трёх seed. '
      'Разделения пересекаются по прогонам; стандартное отклонение не является доверительным интервалом.','',
      '| Выборка | 50% train | 75% train | 100% train |','|---|---:|---:|---:|']
    for name,folder in [('Проверенный малый набор','mlp_group_validation'),
                        ('Исторический, без запаса lookback','mlp_group_validation_historical')]:
        metrics=pd.DataFrame(json.loads((ROOT/folder/'metrics.json').read_text(encoding='utf8')))
        if len(metrics)!=54:raise ValueError(f'Incomplete {folder}')
        grouped=metrics[~metrics.temporal].groupby(['fraction','split']).macro_f1.mean()
        vals=[]
        for fraction in (.5,.75,1.):
            x=grouped.loc[fraction];vals.append(f'{x.mean():.3f} ± {x.std():.3f}')
        lines.append(f'| {name} | '+' | '.join(vals)+' |')
    lines += ['', 'Историческая выборка не имеет временных меток отдельных отсчётов и подтверждений инъекций; '
      'результаты остаются исследовательскими. На малой выборке всего четыре validation-прогона в каждом разделении; '
      'выбор настроек нестабилен. Ранее опубликованный вариант с фиксированным пределом 150 итераций '
      'сохранён в отдельных исходных отчётах и не должен смешиваться с этой оценкой.', '',
      'Воспроизведение: `python research/ml/mlp_group_validation.py` и '
      '`python research/ml/mlp_group_validation.py --data research/evidence/prepared '
      '--base research/ml/audited_results --out research/ml/mlp_group_validation_historical`, '
      'затем `python research/ml/report_mlp_group_validation.py`.']
    (ROOT/'MLP_VALIDATION_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('\n'.join(lines))


if __name__=='__main__':main()
